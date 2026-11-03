// EN: API integration tests via Fastify inject (no network listener). / ES: Tests de integración vía inject (sin escuchar en red).
import { afterEach, describe, expect, it } from 'vitest';
import { SessionManager, memoryBoard } from '@palooza/game-services';
import { FeatureFlags } from '@palooza/rewards';
import { buildSiweMessage } from '@palooza/web3';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const SECRET = 'test-secret-test-secret-test-secret-xx';
const config = loadConfig({ SESSION_SECRET: SECRET, DEV_EXPOSE_RECOVERY_TOKEN: 'true' });

// EN: Controllable clock for sessions. / ES: Reloj controlable para sesiones.
let clock = 1_700_000_000_000;
const tick = (ms: number) => (clock += ms);
let apps: Awaited<ReturnType<typeof buildApp>>[] = [];

async function setup() {
  const sessions = new SessionManager({ now: () => clock, newSeed: () => 'seed-1' });
  const built = await buildApp({ config, sessions, flags: new FeatureFlags(), bootstrapAdmin: { email: 'admin@example.test', password: 'admin-password-123' } });
  apps.push(built);
  return built;
}
afterEach(async () => {
  await Promise.all(apps.map((a) => a.app.close()));
  apps = [];
});

type App = Awaited<ReturnType<typeof setup>>['app'];
const player = { email: 'p1@example.test', password: 'player-password-1', displayName: 'P1', birthDate: '2000-05-05', region: 'AR' };

async function register(app: App, over: Partial<typeof player> = {}) {
  const r = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { ...player, ...over } });
  return { res: r, body: r.json() as { token: string; user: { id: string } } };
}
async function login(app: App, email: string, password: string) {
  return (await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })).json().token as string;
}
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

function perfectFlips(seed: string) {
  const b = memoryBoard(seed);
  const f: number[] = [];
  for (let s = 0; s < 8; s++) f.push(...b.flatMap((v, i) => (v === s ? [i] : [])));
  return f;
}

async function playMemory(app: App, token: string) {
  const s = (await app.inject({ method: 'POST', url: '/v1/games/memory/sessions', headers: auth(token) })).json();
  tick(20_000);
  return (await app.inject({ method: 'POST', url: `/v1/sessions/${s.sessionId}/submit`, headers: auth(token), payload: { input: { flips: perfectFlips(s.seed) } } })).json();
}

// EN: Suite: config.
// ES: Suite: configuración.
describe('config / configuración', () => {
  // EN: Case — requires a strong secret and defaults to localhost.
  // ES: Caso — exige secreto fuerte y localhost.
  it('requires a strong secret and defaults to localhost / exige secreto fuerte y localhost', () => {
    expect(() => loadConfig({})).toThrow();
    expect(config.host).toBe('127.0.0.1');
  });
});

// EN: Suite: public.
// ES: Suite: público.
describe('public / público', () => {
  // EN: Case — health, games, flags off.
  // ES: Caso — salud, juegos, flags apagadas.
  it('health, games, flags off / salud, juegos, flags apagadas', async () => {
    const { app } = await setup();
    expect((await app.inject('/health')).json().ok).toBe(true);
    const games = (await app.inject('/v1/games')).json() as { id: string }[];
    expect(games.map((g) => g.id).sort()).toEqual(['memory', 'merge2048', 'reaction']);
    const flags = (await app.inject('/v1/flags')).json();
    expect(Object.values(flags).every((f: any) => f.on === false)).toBe(true);
    const r = await app.inject('/v1/games');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
});

// EN: Suite: identity.
// ES: Suite: identidad.
describe('identity / identidad', () => {
  // EN: Case — registers, logs in, reads profile without hash.
  // ES: Caso — registra, ingresa, perfil sin hash.
  it('registers, logs in, reads profile without hash / registra, ingresa, perfil sin hash', async () => {
    const { app } = await setup();
    const { res, body } = await register(app);
    expect(res.statusCode).toBe(201);
    const me = (await app.inject({ url: '/v1/me', headers: auth(body.token) })).json();
    expect(me.user.email).toBe(player.email);
    expect(JSON.stringify(me)).not.toContain('scrypt');
    expect(await login(app, player.email, player.password)).toBeTruthy();
  });
  // EN: Case — rejects underage, bad input, weak password, duplicates.
  // ES: Caso — rechaza menores, input inválido, débil, duplicado.
  it('rejects underage, bad input, weak password, duplicates / rechaza menores, input inválido, débil, duplicado', async () => {
    const { app } = await setup();
    expect((await register(app, { birthDate: new Date().toISOString().slice(0, 10) })).res.statusCode).toBe(403);
    expect((await register(app, { email: 'nope' })).res.statusCode).toBe(400);
    expect((await register(app, { password: 'short' })).res.statusCode).toBe(400);
    await register(app);
    expect((await register(app)).res.statusCode).toBe(409);
  });
  // EN: Case — generic login error.
  // ES: Caso — error de login genérico.
  it('generic login error / error de login genérico', async () => {
    const { app } = await setup();
    await register(app);
    const a = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: player.email, password: 'wrong-password-x' } });
    const b = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'ghost@example.test', password: 'wrong-password-x' } });
    expect(a.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });
  // EN: Case — rejects missing/forged tokens and honours logout.
  // ES: Caso — rechaza tokens faltantes/falsos y respeta logout.
  it('rejects missing/forged tokens and honours logout / rechaza tokens faltantes/falsos y respeta logout', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    expect((await app.inject('/v1/me')).statusCode).toBe(401);
    expect((await app.inject({ url: '/v1/me', headers: auth(body.token + 'x') })).statusCode).toBe(401);
    await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth(body.token) });
    expect((await app.inject({ url: '/v1/me', headers: auth(body.token) })).statusCode).toBe(401);
  });
  // EN: Case — password recovery is single-use and non-enumerating.
  // ES: Caso — recuperación de un solo uso y sin enumeración.
  it('password recovery is single-use and non-enumerating / recuperación de un solo uso y sin enumeración', async () => {
    const { app } = await setup();
    await register(app);
    const ghost = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'ghost@example.test' } });
    expect(ghost.statusCode).toBe(202);
    const { devToken } = (await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: player.email } })).json();
    const ok = await app.inject({ method: 'POST', url: '/v1/auth/recovery/confirm', payload: { token: devToken, newPassword: 'brand-new-password' } });
    expect(ok.statusCode).toBe(200);
    const again = await app.inject({ method: 'POST', url: '/v1/auth/recovery/confirm', payload: { token: devToken, newPassword: 'brand-new-password' } });
    expect(again.statusCode).toBe(400);
    expect(await login(app, player.email, 'brand-new-password')).toBeTruthy();
  });
  // EN: Case — export and erase.
  // ES: Caso — exportar y borrar.
  it('export and erase / exportar y borrar', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    await playMemory(app, body.token);
    const exp = (await app.inject({ url: '/v1/me/export', headers: auth(body.token) })).json();
    expect(exp.profile.email).toBe(player.email);
    expect(exp.sessions.length).toBe(1);
    await app.inject({ method: 'DELETE', url: '/v1/me', headers: auth(body.token) });
    const lb = (await app.inject('/v1/leaderboards/memory')).json();
    expect(lb.entries).toHaveLength(0);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: player.email, password: player.password } })).statusCode).toBe(401);
  });
});

// EN: Suite: games → leaderboard → progression → points.
// ES: Suite: juegos → ranking → progresión → puntos.
describe('games → leaderboard → progression → points / juegos → ranking → progresión → puntos', () => {
  // EN: Case — accepted run updates everything.
  // ES: Caso — partida aceptada actualiza todo.
  it('accepted run updates everything / partida aceptada actualiza todo', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    const r = await playMemory(app, body.token);
    expect(r).toMatchObject({ status: 'accepted', score: 1000 });
    // EN: 10 daily + 5 play + 20 memory_high + 50×achievements. / ES: 10 diario + 5 + 20 + 50×logros.
    expect(r.points).toBeGreaterThanOrEqual(35);
    const lb = (await app.inject('/v1/leaderboards/memory')).json();
    expect(lb.entries[0]).toMatchObject({ rank: 1, score: 1000, player: 'P1' });
    expect(JSON.stringify(lb)).not.toContain('@');
    const prog = (await app.inject({ url: '/v1/me/progress', headers: auth(body.token) })).json();
    expect(prog.unlocked).toContain('first_game');
    expect(prog.points).toBe(r.points);
  });
  // EN: Case — rejects too-fast and replayed submissions.
  // ES: Caso — rechaza envíos rápidos y repetidos.
  it('rejects too-fast and replayed submissions / rechaza envíos rápidos y repetidos', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    const s = (await app.inject({ method: 'POST', url: '/v1/games/memory/sessions', headers: auth(body.token) })).json();
    const fast = (await app.inject({ method: 'POST', url: `/v1/sessions/${s.sessionId}/submit`, headers: auth(body.token), payload: { input: { flips: perfectFlips(s.seed) } } })).json();
    expect(fast).toMatchObject({ status: 'rejected', reason: 'too_fast' });
    const again = await app.inject({ method: 'POST', url: `/v1/sessions/${s.sessionId}/submit`, headers: auth(body.token), payload: { input: {} } });
    expect(again.statusCode).toBe(409);
    expect((await app.inject('/v1/leaderboards/memory')).json().entries).toHaveLength(0);
  });
  // EN: Case — unknown game 404.
  // ES: Caso — juego desconocido 404.
  it('unknown game 404 / juego desconocido 404', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    expect((await app.inject({ method: 'POST', url: '/v1/games/roulette/sessions', headers: auth(body.token) })).statusCode).toBe(404);
    expect((await app.inject('/v1/leaderboards/roulette')).statusCode).toBe(404);
  });
});

// EN: Suite: compliance gates.
// ES: Suite: compuertas de cumplimiento.
describe('compliance gates / compuertas de cumplimiento', () => {
  // EN: Case — regulated endpoints return 403 feature_gated.
  // ES: Caso — endpoints regulados devuelven 403.
  it('regulated endpoints return 403 feature_gated / endpoints regulados devuelven 403', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    for (const url of ['/v1/casino/play', '/v1/bets', '/v1/rewards/redeem', '/v1/payouts', '/v1/marketplace/listings']) {
      const r = await app.inject({ method: 'POST', url, headers: auth(body.token), payload: {} });
      expect(r.statusCode).toBe(403);
      expect(r.json().error).toBe('feature_gated');
    }
  });
  // EN: Case — even when an admin flips the flag, unimplemented stays gated.
  // ES: Caso — aunque un admin active la flag, sigue bloqueado.
  it('even when an admin flips the flag, unimplemented stays gated / aunque un admin active la flag, sigue bloqueado', async () => {
    const { app } = await setup();
    const admin = await login(app, 'admin@example.test', 'admin-password-123');
    await app.inject({ method: 'PUT', url: '/v1/admin/flags/betting', headers: auth(admin), payload: { on: true } });
    const r = await app.inject({ method: 'POST', url: '/v1/bets', headers: auth(admin), payload: {} });
    expect(r.statusCode).toBe(403);
  });
});

// EN: Suite: admin & RBAC.
// ES: Suite: admin & RBAC.
describe('admin & RBAC', () => {
  // EN: Case — players cannot reach admin.
  // ES: Caso — jugadores no acceden a admin.
  it('players cannot reach admin / jugadores no acceden a admin', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    for (const url of ['/v1/admin/users', '/v1/admin/audit', '/v1/admin/flags', '/v1/admin/reconcile']) {
      expect((await app.inject({ url, headers: auth(body.token) })).statusCode).toBe(403);
    }
  });
  // EN: Case — freeze, adjust, reconcile, audit, void.
  // ES: Caso — congelar, ajustar, conciliar, auditar, anular.
  it('freeze, adjust, reconcile, audit, void / congelar, ajustar, conciliar, auditar, anular', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    const admin = await login(app, 'admin@example.test', 'admin-password-123');
    const users = (await app.inject({ url: '/v1/admin/users', headers: auth(admin) })).json();
    expect(users.every((u: any) => u.email.includes('***'))).toBe(true);
    const run = await playMemory(app, body.token);
    const voided = await app.inject({ method: 'POST', url: `/v1/admin/sessions/${run.sessionId}/void`, headers: auth(admin) });
    expect(voided.json().status).toBe('voided');
    expect((await app.inject('/v1/leaderboards/memory')).json().entries).toHaveLength(0);
    const noReason = await app.inject({ method: 'POST', url: '/v1/admin/rewards/adjust', headers: auth(admin), payload: { userId: body.user.id, delta: -5 } });
    expect(noReason.statusCode).toBe(400);
    const adj = await app.inject({ method: 'POST', url: '/v1/admin/rewards/adjust', headers: auth(admin), payload: { userId: body.user.id, delta: -5, reason: 'voided cheat run' } });
    expect(adj.statusCode).toBe(200);
    expect((await app.inject({ url: '/v1/admin/reconcile', headers: auth(admin) })).json()).toMatchObject({ ok: true, auditChainValid: true });
    await app.inject({ method: 'POST', url: `/v1/admin/users/${body.user.id}/freeze`, headers: auth(admin), payload: { frozen: true } });
    expect((await app.inject({ url: '/v1/me', headers: auth(body.token) })).json().error).toBe('account_frozen');
    const audit = (await app.inject({ url: '/v1/admin/audit', headers: auth(admin) })).json();
    expect(audit.valid).toBe(true);
    expect(audit.entries.map((e: any) => e.action)).toEqual(expect.arrayContaining(['admin.freeze', 'admin.points_adjust', 'admin.session_void']));
  });
});

// EN: Suite: wallet SIWE.
// ES: Suite: wallet SIWE.
describe('wallet SIWE / wallet SIWE', () => {
  // EN: Case — links a wallet with a valid signature and rejects replays.
  // ES: Caso — vincula con firma válida y rechaza repeticiones.
  it('links a wallet with a valid signature and rejects replays / vincula con firma válida y rechaza repeticiones', async () => {
    const { app } = await setup();
    const { body } = await register(app);
    const acct = privateKeyToAccount(generatePrivateKey());
    const { nonce, domain, uri } = (await app.inject({ method: 'POST', url: '/v1/wallet/nonce', headers: auth(body.token) })).json();
    const message = buildSiweMessage({ domain, address: acct.address, statement: 'Link wallet to Palooza', uri, version: '1', chainId: 31337, nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(Date.now() + 300_000).toISOString() });
    const signature = await acct.signMessage({ message });
    const ok = await app.inject({ method: 'POST', url: '/v1/wallet/link', headers: auth(body.token), payload: { message, signature } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().wallet.toLowerCase()).toBe(acct.address.toLowerCase());
    const replay = await app.inject({ method: 'POST', url: '/v1/wallet/link', headers: auth(body.token), payload: { message, signature } });
    expect(replay.statusCode).toBe(400);
  });
});

// EN: Suite: analytics.
// ES: Suite: analítica.
describe('analytics / analítica', () => {
  // EN: Case — server emits pseudonymous events; client PII is rejected.
  // ES: Caso — el servidor emite eventos seudónimos; se rechaza PII.
  it('server emits pseudonymous events; client PII is rejected / el servidor emite eventos seudónimos; se rechaza PII', async () => {
    const built = await setup();
    const { body } = await register(built.app);
    await playMemory(built.app, body.token);
    const names = built.store.events.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['signup_completed', 'game_started', 'game_completed']));
    expect(JSON.stringify(built.store.events)).not.toContain(player.email);
    const bad = await built.app.inject({ method: 'POST', url: '/v1/events', headers: auth(body.token), payload: { name: 'page_viewed', props: { path: '/x', email: 'a@b.co' } } });
    expect(bad.statusCode).toBe(400);
    const good = await built.app.inject({ method: 'POST', url: '/v1/events', headers: auth(body.token), payload: { name: 'page_viewed', props: { path: '/play' } } });
    expect(good.statusCode).toBe(202);
  });
});
