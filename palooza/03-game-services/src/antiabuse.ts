/**
 * EN: Anti-abuse signals. They never silently change scores: they produce flags that the
 *     session manager uses to reject or hold a result for moderator review.
 * ES: Señales anti-abuso. Nunca cambian puntajes en silencio: producen flags que el gestor de
 *     sesiones usa para rechazar o retener un resultado para revisión de un moderador.
 */
import type { GameDefinition, ReplayResult } from './games/types.js';

export type AbuseSignal = 'impossible_score' | 'too_fast' | 'session_rate' | 'statistical_outlier' | 'invalid_input';

/**
 * EN: Sliding-window rate limiter per key (e.g. sessions started per user per minute).
 * ES: Limitador de ventana deslizante por clave (p. ej. sesiones iniciadas por usuario por minuto).
 */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  /** EN: Record a hit; false if over the limit. / ES: Registra un hit; false si supera el límite. */
  hit(key: string, now = Date.now()): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}

/**
 * EN: Evaluate a replay result against game bounds and elapsed wall-clock time.
 *     `history` = the player's previous valid scores for this game (for outlier detection).
 * ES: Evalúa un resultado contra las cotas del juego y el tiempo real transcurrido.
 *     `history` = puntajes válidos previos del jugador en este juego (para detectar outliers).
 */
export function evaluate(game: GameDefinition, result: ReplayResult, elapsedMs: number, history: number[] = []): AbuseSignal[] {
  const signals: AbuseSignal[] = [];
  if (!result.valid) signals.push('invalid_input');
  if (result.score > game.maxScore) signals.push('impossible_score');
  if (result.completed && elapsedMs < game.minDurationMs) signals.push('too_fast');
  // EN: Outlier: > mean + 4σ with at least 5 samples and a big jump. Held for review, not rejected.
  // ES: Outlier: > media + 4σ con al menos 5 muestras y un salto grande. Se retiene, no se rechaza.
  if (history.length >= 5 && result.score > 0) {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
    if (result.score > mean + 4 * Math.max(sd, mean * 0.05) && result.score > 2 * mean) signals.push('statistical_outlier');
  }
  return signals;
}

/** EN: Signals that reject outright (vs. hold for review). / ES: Señales que rechazan directamente (vs. retener). */
export const REJECTING: readonly AbuseSignal[] = ['impossible_score', 'too_fast', 'invalid_input'];
