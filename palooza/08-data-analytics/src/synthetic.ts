/**
 * EN: Deterministic SYNTHETIC event generator (no real users) for demos, tests and dashboards.
 * ES: Generador determinista de eventos SINTÉTICOS (sin usuarios reales) para demos, tests y dashboards.
 */
import type { AnalyticsEvent, EventName } from './schema.js';

export function syntheticEvents(users = 200, seed = 42, start = Date.UTC(2026, 9, 1)): AnalyticsEvent[] {
  let s = seed >>> 0;
  // EN: Tiny LCG; deterministic. / ES: LCG mínimo; determinista.
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out: AnalyticsEvent[] = [];
  let id = 0;
  const games = ['memory', 'reaction', 'merge2048'];
  for (let u = 0; u < users; u++) {
    const anonId = (u * 2654435761 >>> 0).toString(16).padStart(8, '0') + 'a0';
    let t = start + Math.floor(rnd() * 5) * 86_400_000 + Math.floor(rnd() * 80_000_000);
    const push = (name: EventName, props: AnalyticsEvent['props'] = {}) => {
      t += 1000 + Math.floor(rnd() * 60_000);
      out.push({ v: 1, eventId: `e${id++}`, name, anonId, ts: new Date(t).toISOString(), props });
    };
    push('page_viewed', { path: '/' });
    if (rnd() < 0.2) continue;
    push('signup_started');
    if (rnd() < 0.15) continue;
    push('signup_completed');
    if (rnd() < 0.05) { push('eligibility_failed', { reason: 'underage' }); continue; }
    push('eligibility_passed');
    const sessions = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < sessions; k++) {
      const g = games[Math.floor(rnd() * 3)]!;
      push('game_started', { gameId: g });
      if (rnd() < 0.8) push('game_completed', { gameId: g, score: Math.floor(rnd() * 1000), status: rnd() < 0.95 ? 'accepted' : 'rejected' });
    }
    // EN: Some users return the next day. / ES: Algunos vuelven al día siguiente.
    if (rnd() < 0.35) { t += 86_400_000; push('game_started', { gameId: 'memory' }); }
    if (rnd() < 0.25) { push('wallet_link_started'); if (rnd() < 0.7) push('wallet_linked', { chainId: 31337 }); }
  }
  return out;
}
