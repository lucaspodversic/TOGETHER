/**
 * EN: Game session lifecycle (server-authoritative):
 *       created(start) → submitted → accepted | rejected | held(review) ; or → expired / abandoned
 *     The server picks the seed; the client gets it to render; the client submits raw input once.
 *     Errors are recoverable: an expired session can be restarted, a failed submit returns a reason.
 * ES: Ciclo de vida de una sesión de juego (autoritativo en servidor):
 *       created(inicio) → submitted → accepted | rejected | held(revisión) ; o → expired / abandoned
 *     El servidor elige la semilla; el cliente la recibe para dibujar; el cliente envía su input crudo una vez.
 *     Los errores son recuperables: una sesión vencida se reinicia, un envío fallido devuelve un motivo.
 */
import { evaluate, REJECTING, SlidingWindow, type AbuseSignal } from './antiabuse.js';
import { GAMES } from './games/index.js';

export type SessionStatus = 'active' | 'accepted' | 'rejected' | 'held' | 'expired' | 'abandoned' | 'voided';

export interface GameSession {
  id: string;
  userId: string;
  gameId: string;
  seed: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  score?: number;
  signals?: AbuseSignal[];
  reason?: string;
}

export class GameError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

export interface SessionManagerOptions {
  ttlMs?: number; // EN: max session life / ES: vida máxima de sesión
  startsPerMinute?: number;
  // EN: Injected randomness/ids so tests are deterministic. / ES: Aleatoriedad/ids inyectados para tests deterministas.
  newId?: () => string;
  newSeed?: () => string;
  now?: () => number;
}

/** EN: Outcome listener (rewards, leaderboard, analytics subscribe here). / ES: Listener de resultados. */
export type SessionListener = (s: GameSession) => void;

export class SessionManager {
  private readonly sessions = new Map<string, GameSession>();
  private readonly limiter: SlidingWindow;
  private readonly listeners: SessionListener[] = [];
  private readonly opts: Required<SessionManagerOptions>;
  private counter = 0;

  constructor(opts: SessionManagerOptions = {}) {
    this.opts = {
      ttlMs: opts.ttlMs ?? 30 * 60_000,
      startsPerMinute: opts.startsPerMinute ?? 20,
      newId: opts.newId ?? (() => `s_${Date.now().toString(36)}_${(this.counter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
      newSeed: opts.newSeed ?? (() => globalThis.crypto.randomUUID()),
      now: opts.now ?? Date.now,
    };
    this.limiter = new SlidingWindow(this.opts.startsPerMinute, 60_000);
  }

  /** EN: Subscribe to finished sessions. / ES: Suscribirse a sesiones finalizadas. */
  onFinished(fn: SessionListener): void {
    this.listeners.push(fn);
  }

  /** EN: Start a session for a known game. / ES: Inicia una sesión de un juego conocido. */
  start(userId: string, gameId: string): GameSession {
    if (!GAMES[gameId]) throw new GameError('unknown_game', 404);
    if (!this.limiter.hit(userId, this.opts.now())) throw new GameError('session_rate', 429);
    // EN: One active session per user per game; the old one is marked abandoned (recoverable).
    // ES: Una sesión activa por usuario y juego; la anterior queda abandonada (recuperable).
    for (const s of this.sessions.values()) if (s.userId === userId && s.gameId === gameId && s.status === 'active') s.status = 'abandoned';
    const session: GameSession = { id: this.opts.newId(), userId, gameId, seed: this.opts.newSeed(), status: 'active', startedAt: this.opts.now() };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * EN: Submit raw input. Replays on the server, runs anti-abuse, finalises the session once.
   * ES: Envía el input crudo. Se reproduce en el servidor, corre anti-abuso y finaliza la sesión una vez.
   */
  submit(id: string, userId: string, input: unknown, history: number[] = []): GameSession {
    const s = this.sessions.get(id);
    if (!s || s.userId !== userId) throw new GameError('session_not_found', 404);
    const now = this.opts.now();
    if (s.status === 'active' && now - s.startedAt > this.opts.ttlMs) s.status = 'expired';
    if (s.status !== 'active') throw new GameError(`session_${s.status}`, 409);
    const game = GAMES[s.gameId]!;
    // EN: Payload size guard before replaying. / ES: Guarda de tamaño antes de reproducir.
    const size = JSON.stringify(input ?? null).length;
    if (size > game.maxInputs * 4 + 256) throw new GameError('input_too_large', 413);
    let result;
    try {
      result = game.replay(s.seed, input as never);
    } catch {
      result = { valid: false, score: 0, completed: false, reason: 'replay_error' };
    }
    const signals = evaluate(game, result, now - s.startedAt, history);
    s.endedAt = now;
    s.signals = signals;
    s.score = result.score;
    s.reason = result.reason;
    s.status = signals.some((x) => REJECTING.includes(x)) ? 'rejected' : signals.length ? 'held' : result.completed ? 'accepted' : 'rejected';
    if (s.status === 'rejected' && !s.reason) s.reason = signals[0] ?? 'incomplete';
    for (const fn of this.listeners) fn(s);
    return s;
  }

  /** EN: Moderator action: void a result. / ES: Acción de moderador: anular un resultado. */
  void(id: string): GameSession {
    const s = this.sessions.get(id);
    if (!s) throw new GameError('session_not_found', 404);
    s.status = 'voided';
    for (const fn of this.listeners) fn(s);
    return s;
  }

  /** EN: Moderator action: approve a held result. / ES: Acción de moderador: aprobar un resultado retenido. */
  approve(id: string): GameSession {
    const s = this.sessions.get(id);
    if (!s || s.status !== 'held') throw new GameError('not_held', 409);
    s.status = 'accepted';
    for (const fn of this.listeners) fn(s);
    return s;
  }

  /** EN: Sessions of a user, newest first. / ES: Sesiones de un usuario, más nuevas primero. */
  history(userId: string): GameSession[] {
    return [...this.sessions.values()].filter((s) => s.userId === userId).sort((a, b) => b.startedAt - a.startedAt);
  }

  /** EN: Held sessions awaiting review. / ES: Sesiones retenidas esperando revisión. */
  held(): GameSession[] {
    return [...this.sessions.values()].filter((s) => s.status === 'held');
  }
}
