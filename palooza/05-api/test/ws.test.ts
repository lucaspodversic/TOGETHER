// EN: Live leaderboard over WebSocket (ephemeral port on 127.0.0.1). / ES: Ranking en vivo por WebSocket (puerto efímero en 127.0.0.1).
import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { SessionManager, memoryBoard } from '@palooza/game-services';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// EN: Suite: ws leaderboard.
// ES: Suite: ws leaderboard.
describe('ws leaderboard', () => {
  // EN: Case — pushes snapshot and updates.
  // ES: Caso — envía estado inicial y actualizaciones.
  it('pushes snapshot and updates / envía estado inicial y actualizaciones', async () => {
    let t = 1_700_000_000_000;
    const { app } = await buildApp({ config: loadConfig({ SESSION_SECRET: 'x'.repeat(40) }), sessions: new SessionManager({ now: () => t, newSeed: () => 's' }) });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = (app.server.address() as { port: number }).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/ws/leaderboard?gameId=memory`);
    const msgs: any[] = [];
    const waitFor = (n: number) => new Promise<void>((res) => { const i = setInterval(() => { if (msgs.length >= n) { clearInterval(i); res(); } }, 10); });
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    await waitFor(1);
    expect(msgs[0]).toMatchObject({ type: 'leaderboard', gameId: 'memory', entries: [] });

    const reg = (await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'w@example.test', password: 'password-long-1', displayName: 'Wsy', birthDate: '1999-01-01', region: 'AR' } })).json();
    const h = { authorization: `Bearer ${reg.token}` };
    const s = (await app.inject({ method: 'POST', url: '/v1/games/memory/sessions', headers: h })).json();
    const b = memoryBoard(s.seed);
    const flips: number[] = [];
    for (let k = 0; k < 8; k++) flips.push(...b.flatMap((v, i) => (v === k ? [i] : [])));
    t += 20_000;
    await app.inject({ method: 'POST', url: `/v1/sessions/${s.sessionId}/submit`, headers: h, payload: { input: { flips } } });
    await waitFor(2);
    expect(msgs[1].entries[0]).toMatchObject({ rank: 1, score: 1000, player: 'Wsy' });
    ws.close();
    await app.close();
  });
});
