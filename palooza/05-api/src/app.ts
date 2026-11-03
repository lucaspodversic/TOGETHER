/**
 * EN: Fastify application factory. Wires identity, game services, rewards, web3 linking,
 *     analytics, audit log, REST routes and the live-leaderboard WebSocket.
 *     `buildApp()` never listens; `server.ts` does (127.0.0.1 by default). Tests use `inject()`.
 * ES: Fábrica de la aplicación Fastify. Conecta identidad, servicios de juego, recompensas,
 *     vinculación web3, analítica, auditoría, rutas REST y el WebSocket de rankings en vivo.
 *     `buildApp()` nunca escucha; lo hace `server.ts` (127.0.0.1 por defecto). Los tests usan `inject()`.
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import {
  RecoveryTokens, anonymize, can, checkEligibility, exportUserData, hashPassword, isRole, maskEmail, ownProfile, permissionsOf,
  pseudonymize, publicProfile, randomId, signSession, validatePasswordPolicy, verifyPassword, verifySession, type Permission, type SessionClaims,
} from '@palooza/identity';
import { ACHIEVEMENTS, GAMES, GameError, Leaderboards, Progression, SessionManager, catalogue, type GameSession } from '@palooza/game-services';
import { DEFAULT_RULES, FeatureFlags, GATED_FEATURES, GatedFeatureError, PointsLedger, type GatedFeature } from '@palooza/rewards';
import { NonceStore, verifySiwe } from '@palooza/web3';
import { validateEvent, type AnalyticsEvent, type EventName } from '@palooza/analytics';
import type { Hex } from 'viem';
import { AuditLog } from './audit.js';
import type { Config } from './config.js';
import { MemoryStore, type User } from './store.js';

declare module 'fastify' {
  interface FastifyRequest { claims?: SessionClaims; user?: User }
}

export interface BuildOptions {
  config: Config;
  logger?: boolean;
  flags?: FeatureFlags;
  sessions?: SessionManager;
  bootstrapAdmin?: { email: string; password: string };
}

// EN: Small validation helpers (kept explicit instead of a schema lib for readability).
// ES: Helpers de validación chicos (explícitos en vez de una lib de esquemas, por legibilidad).
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function buildApp(opts: BuildOptions) {
  const { config } = opts;
  const app = Fastify({ logger: opts.logger ? { redact: ['req.headers.authorization', 'req.body.password', 'req.body.newPassword'] } : false, bodyLimit: 256 * 1024 });
  const store = new MemoryStore();
  const audit = new AuditLog();
  const flags = opts.flags ?? FeatureFlags.fromEnv();
  const sessions = opts.sessions ?? new SessionManager();
  const leaderboards = new Leaderboards();
  const progression = new Progression();
  const ledger = new PointsLedger(DEFAULT_RULES, flags);
  const recovery = new RecoveryTokens();
  const nonces = new NonceStore();
  const appliedSessions = new Set<string>();
  const sockets = new Set<{ ws: WebSocket; gameId: string }>();

  // ───── EN: Analytics emitter (server-side, pseudonymous) / ES: Emisor de analítica (servidor, seudónimo) ─────
  const track = (userId: string, name: EventName, props: AnalyticsEvent['props'] = {}) => {
    const e: AnalyticsEvent = { v: 1, eventId: randomId(12), name, anonId: pseudonymize(userId, config.analyticsSalt), ts: new Date().toISOString(), props };
    if (validateEvent(e).length === 0) store.events.push(e);
  };

  // ───── EN: Broadcast leaderboard changes / ES: Difundir cambios de ranking ─────
  const broadcast = (gameId: string) => {
    const payload = JSON.stringify({ type: 'leaderboard', gameId, entries: leaderboardView(gameId) });
    for (const s of sockets) if (s.gameId === gameId && s.ws.readyState === 1) s.ws.send(payload);
  };
  const leaderboardView = (gameId: string) =>
    leaderboards.top(gameId, 20).map((e) => ({ rank: e.rank, score: e.score, at: e.at, player: store.users.get(e.userId)?.displayName ?? 'unknown' }));

  // EN: Every finished session flows into leaderboard → progression → rewards → analytics.
  // ES: Cada sesión finalizada pasa por ranking → progresión → recompensas → analítica.
  sessions.onFinished((s: GameSession) => {
    if (leaderboards.record(s)) broadcast(s.gameId);
    track(s.userId, 'game_completed', { gameId: s.gameId, score: s.score ?? 0, status: s.status });
    if (s.status !== 'accepted') return;
    const unlocked = progression.apply(s, GAMES[s.gameId]!.maxScore, appliedSessions);
    ledger.process({ type: 'session_accepted', userId: s.userId, ref: s.id, gameId: s.gameId, score: s.score, at: s.endedAt ?? Date.now() });
    for (const a of unlocked) {
      ledger.process({ type: 'achievement_unlocked', userId: s.userId, ref: `${s.userId}:${a}`, at: Date.now() });
      track(s.userId, 'achievement_unlocked', { achievementId: a });
    }
  });

  await app.register(cors, { origin: [config.webOrigin], credentials: false });
  // EN: Global rate limit; auth routes get stricter per-route limits below.
  // ES: Límite global; las rutas de auth tienen límites más estrictos abajo.
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(websocket);

  // EN: Security headers on every response. / ES: Headers de seguridad en cada respuesta.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Cache-Control', 'no-store');
    return payload;
  });

  // EN: Uniform error mapping; never leak stack traces. / ES: Mapeo uniforme de errores; nunca filtrar stacks.
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof GameError) return reply.code(err.status).send({ error: err.code });
    if (err instanceof GatedFeatureError) return reply.code(403).send({ error: 'feature_gated', feature: err.feature });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'rate_limited' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.code ?? 'bad_request' });
    app.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  // ───── EN: Auth helpers / ES: Helpers de auth ─────
  const issue = (u: User) => {
    const claims: SessionClaims = { sub: u.id, role: u.role, sid: randomId(12), exp: Math.floor(Date.now() / 1000) + config.sessionTtlSec };
    return { token: signSession(claims, config.sessionSecret), expiresAt: claims.exp };
  };

  const authenticate = async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization ?? '';
    const claims = h.startsWith('Bearer ') ? verifySession(h.slice(7), config.sessionSecret) : null;
    const user = claims ? store.users.get(claims.sub) : undefined;
    if (!claims || !user || store.revokedSessions.has(claims.sid)) return reply.code(401).send({ error: 'unauthorized' });
    if (user.frozen) return reply.code(403).send({ error: 'account_frozen' });
    // EN: Role is re-read from the store so demotions apply immediately. / ES: El rol se relee para que las degradaciones apliquen al instante.
    req.claims = { ...claims, role: user.role };
    req.user = user;
  };

  const requirePerm = (perm: Permission) => async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticate(req, reply);
    if (reply.sent) return;
    if (!can(req.user!.role, perm)) return reply.code(403).send({ error: 'forbidden', need: perm });
  };

  // EN: Optional first admin from env (never hardcoded). / ES: Admin inicial opcional desde env (nunca hardcodeado).
  if (opts.bootstrapAdmin) {
    const id = store.nextId('u');
    store.addUser({ id, email: opts.bootstrapAdmin.email, displayName: 'admin', birthDate: '1990-01-01', region: 'ZZ', role: 'admin', createdAt: new Date().toISOString(), passwordHash: hashPassword(opts.bootstrapAdmin.password), frozen: false, wallet: null });
    audit.record('system', 'admin.bootstrap', id);
  }

  // ───── EN: Public / ES: Público ─────
  // EN: GET — Liveness probe; also reports whether the audit hash chain is intact.
  // ES: GET — Sonda de vida; también informa si la cadena de hash de auditoría está intacta.
  // Auth/limits · Auth/límites: public
  app.get('/health', async () => ({ ok: true, auditChainValid: audit.verify() }));
  // EN: GET — Public flag snapshot so the UI can hide gated features (all OFF by default).
  // ES: GET — Estado público de flags para que la UI oculte funciones bloqueadas (todas OFF por defecto).
  // Auth/limits · Auth/límites: public
  app.get('/v1/flags', async () => flags.snapshot());
  // EN: GET — Game catalogue (casual + skill only; no casino games exist in the registry).
  // ES: GET — Catálogo de juegos (solo casuales y de habilidad; no hay juegos de casino en el registro).
  // Auth/limits · Auth/límites: public
  app.get('/v1/games', async () => catalogue());
  // EN: GET — Achievement definitions without their internal test functions.
  // ES: GET — Definiciones de logros sin sus funciones internas de evaluación.
  // Auth/limits · Auth/límites: public
  app.get('/v1/achievements', async () => ACHIEVEMENTS.map(({ id, title }) => ({ id, title })));
  // EN: GET — Active reward rules, published so players can see exactly how points are earned.
  // ES: GET — Reglas de recompensa activas, publicadas para que se vea exactamente cómo se ganan puntos.
  // Auth/limits · Auth/límites: public
  app.get('/v1/rewards/rules', async () => DEFAULT_RULES.filter((r) => r.active).map(({ id, version, description, points, dailyCap }) => ({ id, version, description, points, dailyCap })));
  // EN: GET — Top-20 snapshot for a game; exposes display names only (no emails/ids).
  // ES: GET — Top 20 de un juego; expone solo nombres visibles (sin emails ni ids).
  // Auth/limits · Auth/límites: public · 404 unknown_game
  app.get<{ Params: { gameId: string } }>('/v1/leaderboards/:gameId', async (req, reply) => {
    if (!GAMES[req.params.gameId]) return reply.code(404).send({ error: 'unknown_game' });
    return { gameId: req.params.gameId, entries: leaderboardView(req.params.gameId) };
  });

  // ───── EN: Identity / ES: Identidad ─────
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  // EN: POST — Create account after input validation, password policy and age/region eligibility.
  // ES: POST — Crea la cuenta tras validar input, política de contraseña y elegibilidad por edad/región.
  // Auth/limits · Auth/límites: public · 400/403/409 · 10 req/min
  app.post('/v1/auth/register', authLimit, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = str(b.email, 254);
    const password = typeof b.password === 'string' ? b.password : '';
    const displayName = str(b.displayName, 32);
    const birthDate = str(b.birthDate, 10);
    const region = str(b.region, 2);
    if (!email || !EMAIL_RE.test(email) || !displayName || !birthDate || !region) return reply.code(400).send({ error: 'invalid_input' });
    const pwErr = validatePasswordPolicy(password);
    if (pwErr) return reply.code(400).send({ error: pwErr });
    // EN: Eligibility before account creation; birthdate is used for the check and stored for re-checks only.
    // ES: Elegibilidad antes de crear la cuenta; la fecha se usa para el chequeo y se guarda solo para re-chequeos.
    const elig = checkEligibility({ birthDate, region });
    if (!elig.ok) return reply.code(403).send({ error: 'not_eligible', reason: elig.reason });
    // EN: Same response shape for duplicates is not possible at register; we use a generic 409.
    // ES: En el registro no se puede ocultar el duplicado; usamos un 409 genérico.
    if (store.findByEmail(email)) return reply.code(409).send({ error: 'email_unavailable' });
    const u: User = { id: store.nextId('u'), email, displayName, birthDate, region: region.toUpperCase(), role: 'player', createdAt: new Date().toISOString(), passwordHash: hashPassword(password), frozen: false, wallet: null };
    store.addUser(u);
    audit.record(u.id, 'auth.register', u.id, { email: maskEmail(email) });
    track(u.id, 'signup_completed');
    track(u.id, 'eligibility_passed');
    ledger.process({ type: 'daily_login', userId: u.id, ref: `${u.id}:${new Date().toISOString().slice(0, 10)}`, at: Date.now() });
    return reply.code(201).send({ user: ownProfile(u), ...issue(u) });
  });

  // EN: POST — Password login returning a signed session token; failures are audited.
  // ES: POST — Login con contraseña que devuelve un token firmado; los fallos se auditan.
  // Auth/limits · Auth/límites: public · 401 invalid_credentials · 10 req/min
  app.post('/v1/auth/login', authLimit, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const u = typeof b.email === 'string' ? store.findByEmail(b.email) : undefined;
    // EN: Generic error for unknown email or wrong password (no account enumeration).
    // ES: Error genérico para email desconocido o contraseña incorrecta (sin enumerar cuentas).
    if (!u || typeof b.password !== 'string' || !verifyPassword(b.password, u.passwordHash)) {
      audit.record('anonymous', 'auth.login_failed');
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    if (u.frozen) return reply.code(403).send({ error: 'account_frozen' });
    audit.record(u.id, 'auth.login', u.id);
    ledger.process({ type: 'daily_login', userId: u.id, ref: `${u.id}:${new Date().toISOString().slice(0, 10)}`, at: Date.now() });
    return { user: ownProfile(u), ...issue(u) };
  });

  // EN: POST — Revoke the current session id server-side.
  // ES: POST — Revoca el id de sesión actual en el servidor.
  // Auth/limits · Auth/límites: bearer
  app.post('/v1/auth/logout', { preHandler: authenticate }, async (req) => {
    store.revokedSessions.add(req.claims!.sid);
    audit.record(req.user!.id, 'auth.logout');
    return { ok: true };
  });

  // EN: POST — Start password recovery; response is identical whether or not the email exists.
  // ES: POST — Inicia la recuperación; la respuesta es idéntica exista o no el email.
  // Auth/limits · Auth/límites: public · 202 · 10 req/min
  app.post('/v1/auth/recovery/request', authLimit, async (req, reply) => {
    const email = (req.body as { email?: string } | undefined)?.email;
    const u = typeof email === 'string' ? store.findByEmail(email) : undefined;
    let token: string | undefined;
    if (u) {
      token = recovery.issue(u.id);
      audit.record(u.id, 'auth.recovery_requested');
    }
    // EN: Always 202 so attackers can't probe emails. Delivery (email) is an integration point.
    // ES: Siempre 202 para que no se puedan sondear emails. El envío (email) es un punto de integración.
    return reply.code(202).send({ ok: true, ...(config.devExposeRecoveryToken && token ? { devToken: token } : {}) });
  });

  // EN: POST — Consume a single-use recovery token and set a new password.
  // ES: POST — Consume un token de recuperación de un solo uso y fija una nueva contraseña.
  // Auth/limits · Auth/límites: public · 400 invalid_or_expired_token
  app.post('/v1/auth/recovery/confirm', authLimit, async (req, reply) => {
    const b = (req.body ?? {}) as { token?: string; newPassword?: string };
    const pwErr = validatePasswordPolicy(b.newPassword ?? '');
    if (pwErr) return reply.code(400).send({ error: pwErr });
    const userId = typeof b.token === 'string' ? recovery.consume(b.token) : null;
    const u = userId ? store.users.get(userId) : undefined;
    if (!u) return reply.code(400).send({ error: 'invalid_or_expired_token' });
    u.passwordHash = hashPassword(b.newPassword!);
    audit.record(u.id, 'auth.password_reset', u.id);
    return { ok: true };
  });

  // ───── EN: Profile & privacy / ES: Perfil y privacidad ─────
  // EN: GET — Own profile endpoint (read, rename, or erase depending on the verb).
  // ES: GET — Endpoint del propio perfil (leer, renombrar o borrar según el verbo).
  // Auth/limits · Auth/límites: bearer
  app.get('/v1/me', { preHandler: authenticate }, async (req) => {
    const u = req.user!;
    return { user: ownProfile(u), permissions: permissionsOf(u.role) };
  });

  // EN: PATCH — Own profile endpoint (read, rename, or erase depending on the verb).
  // ES: PATCH — Endpoint del propio perfil (leer, renombrar o borrar según el verbo).
  // Auth/limits · Auth/límites: bearer
  app.patch('/v1/me', { preHandler: authenticate }, async (req, reply) => {
    const name = str((req.body as { displayName?: string } | undefined)?.displayName, 32);
    if (!name) return reply.code(400).send({ error: 'invalid_input' });
    req.user!.displayName = name;
    return { user: ownProfile(req.user!) };
  });

  // EN: GET — Level, XP, achievements, play-point balance, recent ledger and sessions.
  // ES: GET — Nivel, XP, logros, saldo de puntos, ledger reciente y sesiones.
  // Auth/limits · Auth/límites: bearer
  app.get('/v1/me/progress', { preHandler: authenticate }, async (req) => {
    const id = req.user!.id;
    return {
      ...progression.get(id),
      points: ledger.balance(id),
      pointsNote: 'Non-monetary play points / Puntos de juego no monetarios',
      ledger: ledger.history(id).slice(-50).map(({ seq, delta, kind, ruleId, reason, at }) => ({ seq, delta, kind, ruleId, reason, at })),
      sessions: sessions.history(id).slice(0, 20).map(({ id: sid, gameId, status, score, startedAt, reason }) => ({ id: sid, gameId, status, score, startedAt, reason })),
    };
  });

  // EN: GET — Data-portability export of everything held about the caller.
  // ES: GET — Exportación de portabilidad con todo lo guardado sobre quien llama.
  // Auth/limits · Auth/límites: bearer · audited
  app.get('/v1/me/export', { preHandler: authenticate }, async (req) => {
    const id = req.user!.id;
    audit.record(id, 'privacy.export');
    return exportUserData(req.user!, { progress: progression.get(id), ledger: ledger.history(id), sessions: sessions.history(id) });
  });

  // EN: DELETE — Own profile endpoint (read, rename, or erase depending on the verb).
  // ES: DELETE — Endpoint del propio perfil (leer, renombrar o borrar según el verbo).
  // Auth/limits · Auth/límites: bearer
  app.delete('/v1/me', { preHandler: authenticate }, async (req) => {
    // EN: Erasure keeps an anonymised tombstone (ledger/audit integrity). / ES: El borrado deja una lápida anónima.
    const u = req.user!;
    store.byEmail.delete(u.email.toLowerCase());
    Object.assign(u, anonymize(u), { passwordHash: '!', frozen: true });
    leaderboards.removeUser(u.id);
    store.revokedSessions.add(req.claims!.sid);
    audit.record(u.id, 'privacy.erase', u.id);
    return { ok: true };
  });

  // ───── EN: Game sessions / ES: Sesiones de juego ─────
  // EN: POST — Start a server-authoritative session; returns the seed the client must use.
  // ES: POST — Inicia una sesión autoritativa del servidor; devuelve la semilla que debe usar el cliente.
  // Auth/limits · Auth/límites: bearer · 404 unknown_game · 429 session_rate
  app.post<{ Params: { gameId: string } }>('/v1/games/:gameId/sessions', { preHandler: authenticate }, async (req, reply) => {
    const s = sessions.start(req.user!.id, req.params.gameId);
    track(req.user!.id, 'game_started', { gameId: s.gameId });
    return reply.code(201).send({ sessionId: s.id, gameId: s.gameId, seed: s.seed, startedAt: s.startedAt });
  });

  // EN: POST — Submit raw input; the server replays it, scores it and runs anti-abuse checks.
  // ES: POST — Envía el input crudo; el servidor lo reproduce, puntúa y aplica anti-abuso.
  // Auth/limits · Auth/límites: bearer · 403/404/409/410
  app.post<{ Params: { id: string } }>('/v1/sessions/:id/submit', { preHandler: authenticate }, async (req) => {
    const existing = sessions.get(req.params.id);
    const history = existing ? leaderboards.scoresOf(existing.gameId, req.user!.id) : [];
    const s = sessions.submit(req.params.id, req.user!.id, (req.body as { input?: unknown } | undefined)?.input, history);
    return { sessionId: s.id, status: s.status, score: s.score, reason: s.reason, signals: s.signals, progress: progression.get(req.user!.id), points: ledger.balance(req.user!.id) };
  });

  // ───── EN: Wallet linking (SIWE) / ES: Vinculación de wallet (SIWE) ─────
  // EN: POST — Issue a short-lived SIWE nonce bound to the caller.
  // ES: POST — Emite un nonce SIWE de vida corta atado a quien llama.
  // Auth/limits · Auth/límites: bearer
  app.post('/v1/wallet/nonce', { preHandler: authenticate }, async (req) => {
    track(req.user!.id, 'wallet_link_started');
    return { nonce: nonces.issue(req.user!.id), domain: config.siweDomain, uri: config.webOrigin };
  });

  // EN: POST — Verify a SIWE signature (domain, nonce, chain, expiry) and link the address.
  // ES: POST — Verifica una firma SIWE (dominio, nonce, cadena, expiración) y vincula la dirección.
  // Auth/limits · Auth/límites: bearer · 400/409
  app.post('/v1/wallet/link', { preHandler: authenticate }, async (req, reply) => {
    const b = (req.body ?? {}) as { message?: string; signature?: string };
    if (typeof b.message !== 'string' || typeof b.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(b.signature)) return reply.code(400).send({ error: 'invalid_input' });
    let address: string;
    try {
      address = await verifySiwe(b.message, b.signature as Hex, { expectedDomain: config.siweDomain, nonces, userId: req.user!.id });
    } catch (e) {
      audit.record(req.user!.id, 'wallet.link_failed', undefined, { code: (e as Error).message });
      return reply.code(400).send({ error: (e as Error).message });
    }
    const other = store.walletOwner(address);
    if (other && other.id !== req.user!.id) return reply.code(409).send({ error: 'wallet_linked_elsewhere' });
    req.user!.wallet = address;
    audit.record(req.user!.id, 'wallet.linked', address);
    track(req.user!.id, 'wallet_linked', { chainId: Number(/Chain ID: (\d+)/.exec(b.message)?.[1] ?? 0) });
    return { wallet: address, profile: publicProfile(req.user!) };
  });

  // EN: DELETE — Unlink the wallet (off-chain only; nothing is sent to a chain).
  // ES: DELETE — Desvincula la wallet (solo off-chain; no se envía nada a la cadena).
  // Auth/limits · Auth/límites: bearer
  app.delete('/v1/wallet', { preHandler: authenticate }, async (req) => {
    req.user!.wallet = null;
    audit.record(req.user!.id, 'wallet.unlinked');
    return { ok: true };
  });

  // ───── EN: Gated (regulated) features — always refused in this build / ES: Funciones reguladas — siempre rechazadas ─────
  for (const [path, feature] of [['/v1/casino/play', 'casino_games'], ['/v1/bets', 'betting'], ['/v1/rewards/redeem', 'token_rewards'], ['/v1/payouts', 'payouts'], ['/v1/marketplace/listings', 'marketplace']] as const) {
    // EN: POST — Regulated feature stub: always answers 403 feature_gated in this build.
    // ES: POST — Stub de función regulada: siempre responde 403 feature_gated en esta versión.
    // Auth/limits · Auth/límites: bearer · 403
    app.post(path, { preHandler: authenticate }, async () => {
      flags.require(feature);
      return { unreachable: true };
    });
  }

  // ───── EN: Client analytics intake (validated, pseudonymised) / ES: Ingesta de analítica del cliente ─────
  // EN: POST — Client analytics intake limited to an allow-list of UI events; PII is rejected.
  // ES: POST — Ingesta de analítica del cliente limitada a eventos de UI permitidos; se rechaza PII.
  // Auth/limits · Auth/límites: bearer · 400/202
  app.post('/v1/events', { preHandler: authenticate }, async (req, reply) => {
    const b = (req.body ?? {}) as { name?: EventName; props?: AnalyticsEvent['props'] };
    const allowed: EventName[] = ['page_viewed', 'error_shown', 'signup_started'];
    if (!b.name || !allowed.includes(b.name)) return reply.code(400).send({ error: 'event_not_allowed' });
    const e: AnalyticsEvent = { v: 1, eventId: randomId(12), name: b.name, anonId: pseudonymize(req.user!.id, config.analyticsSalt), ts: new Date().toISOString(), props: b.props ?? {} };
    const errs = validateEvent(e);
    if (errs.length) return reply.code(400).send({ error: 'invalid_event', details: errs });
    store.events.push(e);
    return reply.code(202).send({ ok: true });
  });

  // ───── EN: Admin (RBAC) / ES: Admin (RBAC) ─────
  // EN: GET — User list with masked emails for support staff.
  // ES: GET — Lista de usuarios con emails enmascarados para soporte.
  // Auth/limits · Auth/límites: perm users:read
  app.get('/v1/admin/users', { preHandler: requirePerm('users:read') }, async () =>
    [...store.users.values()].map((u) => ({ id: u.id, email: maskEmail(u.email), displayName: u.displayName, role: u.role, frozen: u.frozen, region: u.region, points: ledger.balance(u.id) })));

  // EN: POST — Freeze/unfreeze an account (blocks every authenticated call).
  // ES: POST — Congela/descongela una cuenta (bloquea toda llamada autenticada).
  // Auth/limits · Auth/límites: perm users:freeze · audited
  app.post<{ Params: { id: string } }>('/v1/admin/users/:id/freeze', { preHandler: requirePerm('users:freeze') }, async (req, reply) => {
    const u = store.users.get(req.params.id);
    if (!u) return reply.code(404).send({ error: 'not_found' });
    const frozen = (req.body as { frozen?: boolean } | undefined)?.frozen !== false;
    if (u.id === req.user!.id) return reply.code(400).send({ error: 'cannot_freeze_self' });
    u.frozen = frozen;
    audit.record(req.user!.id, frozen ? 'admin.freeze' : 'admin.unfreeze', u.id);
    return { id: u.id, frozen };
  });

  // EN: POST — Change a user's role; restricted to admins.
  // ES: POST — Cambia el rol de un usuario; restringido a admins.
  // Auth/limits · Auth/límites: perm flags:write · audited
  app.post<{ Params: { id: string } }>('/v1/admin/users/:id/role', { preHandler: requirePerm('flags:write') }, async (req, reply) => {
    const u = store.users.get(req.params.id);
    const role = (req.body as { role?: string } | undefined)?.role;
    if (!u || !isRole(role)) return reply.code(400).send({ error: 'invalid_input' });
    u.role = role;
    audit.record(req.user!.id, 'admin.role_change', u.id, { role });
    return { id: u.id, role };
  });

  // EN: GET — Sessions held by the statistical-outlier signal, awaiting review.
  // ES: GET — Sesiones retenidas por la señal de outlier estadístico, esperando revisión.
  // Auth/limits · Auth/límites: perm scores:void
  app.get('/v1/admin/sessions/held', { preHandler: requirePerm('scores:void') }, async () => sessions.held());

  // EN: POST — Approve or void a session; voiding removes it from leaderboards.
  // ES: POST — Aprueba o anula una sesión; anular la saca de los rankings.
  // Auth/limits · Auth/límites: perm scores:void · audited
  app.post<{ Params: { id: string; action: string } }>('/v1/admin/sessions/:id/:action', { preHandler: requirePerm('scores:void') }, async (req, reply) => {
    const { id, action } = req.params;
    if (action !== 'void' && action !== 'approve') return reply.code(404).send({ error: 'not_found' });
    const s = action === 'void' ? sessions.void(id) : sessions.approve(id);
    audit.record(req.user!.id, `admin.session_${action}`, id);
    return { id: s.id, status: s.status };
  });

  // EN: POST — Manual point adjustment; a reason is mandatory and balances cannot go negative.
  // ES: POST — Ajuste manual de puntos; el motivo es obligatorio y el saldo no puede ser negativo.
  // Auth/limits · Auth/límites: perm rewards:adjust · audited
  app.post('/v1/admin/rewards/adjust', { preHandler: requirePerm('rewards:adjust') }, async (req, reply) => {
    const b = (req.body ?? {}) as { userId?: string; delta?: number; reason?: string };
    if (!b.userId || !store.users.has(b.userId)) return reply.code(404).send({ error: 'not_found' });
    try {
      const rec = ledger.adjust(b.userId, Number(b.delta), req.user!.id, String(b.reason ?? ''));
      audit.record(req.user!.id, 'admin.points_adjust', b.userId, { delta: rec.delta, reason: rec.reason });
      return { seq: rec.seq, balance: ledger.balance(b.userId) };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // EN: GET — Recompute ledger hashes/balances and check the audit chain.
  // ES: GET — Recalcula hashes/saldos del ledger y verifica la cadena de auditoría.
  // Auth/limits · Auth/límites: perm rewards:adjust
  app.get('/v1/admin/reconcile', { preHandler: requirePerm('rewards:adjust') }, async () => {
    const r = ledger.reconcile();
    return { ok: r.ok, problems: r.problems, users: Object.keys(r.totals).length, auditChainValid: audit.verify() };
  });

  // EN: GET — Read flag state including whether each feature is implemented.
  // ES: GET — Lee el estado de flags e indica si cada función está implementada.
  // Auth/limits · Auth/límites: perm flags:read
  app.get('/v1/admin/flags', { preHandler: requirePerm('flags:read') }, async () => flags.snapshot());

  // EN: PUT — Toggle a flag; unimplemented features stay refused even when ON.
  // ES: PUT — Cambia una flag; las funciones no implementadas siguen rechazadas aunque estén ON.
  // Auth/limits · Auth/límites: perm flags:write · audited
  app.put<{ Params: { flag: string } }>('/v1/admin/flags/:flag', { preHandler: requirePerm('flags:write') }, async (req, reply) => {
    const f = req.params.flag as GatedFeature;
    if (!GATED_FEATURES.includes(f)) return reply.code(404).send({ error: 'unknown_flag' });
    const on = (req.body as { on?: boolean } | undefined)?.on === true;
    flags.set(f, on);
    audit.record(req.user!.id, 'admin.flag_set', f, { on });
    return flags.snapshot();
  });

  // EN: GET — Latest 200 audit entries plus chain validity.
  // ES: GET — Últimas 200 entradas de auditoría y validez de la cadena.
  // Auth/limits · Auth/límites: perm audit:read
  app.get('/v1/admin/audit', { preHandler: requirePerm('audit:read') }, async () => ({ valid: audit.verify(), entries: audit.list(200) }));

  // EN: GET — Latest pseudonymous analytics events for debugging dashboards.
  // ES: GET — Últimos eventos de analítica seudónimos para depurar tableros.
  // Auth/limits · Auth/límites: perm audit:read
  app.get('/v1/admin/analytics/events', { preHandler: requirePerm('audit:read') }, async () => ({ count: store.events.length, events: store.events.slice(-200) }));

  // ───── EN: Live leaderboard WebSocket / ES: WebSocket de rankings en vivo ─────
  // EN: GET — WebSocket: sends a snapshot on connect, then pushes changes for ?gameId.
  // ES: GET — WebSocket: envía el estado al conectar y luego los cambios de ?gameId.
  // Auth/limits · Auth/límites: public
  app.get<{ Querystring: { gameId?: string } }>('/v1/ws/leaderboard', { websocket: true }, (socket, req) => {
    const gameId = req.query.gameId && GAMES[req.query.gameId] ? req.query.gameId : 'memory';
    const entry = { ws: socket as unknown as WebSocket, gameId };
    sockets.add(entry);
    socket.send(JSON.stringify({ type: 'leaderboard', gameId, entries: leaderboardView(gameId) }));
    socket.on('close', () => sockets.delete(entry));
  });

  return { app, store, audit, flags, sessions, ledger, leaderboards };
}
