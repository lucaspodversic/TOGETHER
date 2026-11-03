// EN: Session lifecycle, anti-abuse, leaderboards, progression. / ES: Ciclo de sesión, anti-abuso, rankings, progresión.
import { describe, expect, it } from 'vitest';
import { GameError, Leaderboards, Progression, SessionManager, SlidingWindow, evaluate, levelFor, memoryBoard, memoryGame, type GameSession } from '../src/index.js';

function perfect(seed: string) {
  const b = memoryBoard(seed);
  const f: number[] = [];
  for (let s = 0; s < 8; s++) f.push(...b.flatMap((v, i) => (v === s ? [i] : [])));
  return f;
}

// EN: Controllable clock. / ES: Reloj controlable.
function mk(opts: { startsPerMinute?: number } = {}) {
  let t = 1_000_000;
  let n = 0;
  const m = new SessionManager({ now: () => t, newId: () => `s${n++}`, newSeed: () => 'seed', ...opts });
  return { m, tick: (ms: number) => (t += ms) };
}

// EN: Suite: session lifecycle.
// ES: Suite: ciclo de sesión.
describe('session lifecycle / ciclo de sesión', () => {
  // EN: Case — accepts a legit run.
  // ES: Caso — acepta partida legítima.
  it('accepts a legit run / acepta partida legítima', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'memory');
    tick(20_000);
    expect(m.submit(s.id, 'u1', { flips: perfect('seed') })).toMatchObject({ status: 'accepted', score: 1000 });
  });
  // EN: Case — rejects too-fast runs.
  // ES: Caso — rechaza partidas demasiado rápidas.
  it('rejects too-fast runs / rechaza partidas demasiado rápidas', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'memory');
    tick(500);
    expect(m.submit(s.id, 'u1', { flips: perfect('seed') })).toMatchObject({ status: 'rejected', reason: 'too_fast' });
  });
  // EN: Case — single submit.
  // ES: Caso — un solo envío.
  it('single submit / un solo envío', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'memory');
    tick(20_000);
    m.submit(s.id, 'u1', { flips: perfect('seed') });
    expect(() => m.submit(s.id, 'u1', { flips: perfect('seed') })).toThrow('session_accepted');
  });
  // EN: Case — expires.
  // ES: Caso — expira.
  it('expires / expira', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'memory');
    tick(31 * 60_000);
    expect(() => m.submit(s.id, 'u1', {})).toThrow('session_expired');
  });
  // EN: Case — other user cannot submit.
  // ES: Caso — otro usuario no puede enviar.
  it('other user cannot submit / otro usuario no puede enviar', () => {
    const { m } = mk();
    const s = m.start('u1', 'memory');
    expect(() => m.submit(s.id, 'u2', {})).toThrow(GameError);
  });
  // EN: Case — unknown game 404.
  // ES: Caso — juego desconocido.
  it('unknown game 404 / juego desconocido', () => expect(() => mk().m.start('u1', 'roulette')).toThrow('unknown_game'));
  // EN: Case — rate limits starts.
  // ES: Caso — limita inicios.
  it('rate limits starts / limita inicios', () => {
    const { m } = mk({ startsPerMinute: 2 });
    m.start('u1', 'memory');
    m.start('u1', 'memory');
    expect(() => m.start('u1', 'memory')).toThrow('session_rate');
  });
  // EN: Case — restart abandons previous.
  // ES: Caso — reiniciar abandona la anterior.
  it('restart abandons previous / reiniciar abandona la anterior', () => {
    const { m } = mk();
    const a = m.start('u1', 'memory');
    m.start('u1', 'memory');
    expect(m.get(a.id)!.status).toBe('abandoned');
  });
  // EN: Case — replay crash is contained.
  // ES: Caso — fallo de reproducción contenido.
  it('replay crash is contained / fallo de reproducción contenido', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'merge2048');
    tick(1000);
    expect(m.submit(s.id, 'u1', null).status).toBe('rejected');
  });
  // EN: Case — oversized input 413.
  // ES: Caso — input enorme.
  it('oversized input 413 / input enorme', () => {
    const { m } = mk();
    const s = m.start('u1', 'reaction');
    expect(() => m.submit(s.id, 'u1', { times: Array(5000).fill(300) })).toThrow('input_too_large');
  });
  // EN: Case — void + approve flows.
  // ES: Caso — flujos de anular y aprobar.
  it('void + approve flows / flujos de anular y aprobar', () => {
    const { m, tick } = mk();
    const s = m.start('u1', 'memory');
    tick(20_000);
    m.submit(s.id, 'u1', { flips: perfect('seed') }, [150, 150, 150, 150, 150]);
    expect(m.get(s.id)!.status).toBe('held');
    expect(m.held()).toHaveLength(1);
    expect(m.approve(s.id).status).toBe('accepted');
    expect(m.void(s.id).status).toBe('voided');
  });
  // EN: Case — listeners fire.
  // ES: Caso — listeners se disparan.
  it('listeners fire / listeners se disparan', () => {
    const { m, tick } = mk();
    const seen: string[] = [];
    m.onFinished((s) => seen.push(s.status));
    const s = m.start('u1', 'reaction');
    tick(10_000);
    m.submit(s.id, 'u1', { times: [300, 300, 300, 300, 300] });
    expect(seen).toEqual(['accepted']);
  });
});

// EN: Suite: anti-abuse.
// ES: Suite: anti-abuso.
describe('anti-abuse / anti-abuso', () => {
  // EN: Case — impossible score.
  // ES: Caso — puntaje imposible.
  it('impossible score / puntaje imposible', () => expect(evaluate(memoryGame, { valid: true, completed: true, score: 5000 }, 99_999)).toContain('impossible_score'));
  // EN: Case — outlier held.
  // ES: Caso — outlier retenido.
  it('outlier held / outlier retenido', () => expect(evaluate(memoryGame, { valid: true, completed: true, score: 1000 }, 99_999, [100, 110, 120, 100, 105])).toContain('statistical_outlier'));
  // EN: Case — normal variation ok.
  // ES: Caso — variación normal ok.
  it('normal variation ok / variación normal ok', () => expect(evaluate(memoryGame, { valid: true, completed: true, score: 800 }, 99_999, [700, 750, 800, 720, 760])).toEqual([]));
  // EN: Case — sliding window.
  // ES: Caso — ventana deslizante.
  it('sliding window / ventana deslizante', () => {
    const w = new SlidingWindow(1, 1000);
    expect(w.hit('k', 0)).toBe(true);
    expect(w.hit('k', 500)).toBe(false);
    expect(w.hit('k', 1500)).toBe(true);
  });
});

const sess = (o: Partial<GameSession>): GameSession => ({ id: 'x', userId: 'u', gameId: 'memory', seed: 's', status: 'accepted', startedAt: 0, endedAt: 0, score: 0, ...o });

// EN: Suite: leaderboards.
// ES: Suite: rankings.
describe('leaderboards / rankings', () => {
  // EN: Case — best per user, ties by time.
  // ES: Caso — mejor por usuario, empates por tiempo.
  it('best per user, ties by time / mejor por usuario, empates por tiempo', () => {
    const lb = new Leaderboards();
    lb.record(sess({ id: 'a', userId: 'u1', score: 500, endedAt: 1 }));
    lb.record(sess({ id: 'b', userId: 'u1', score: 900, endedAt: 2 }));
    lb.record(sess({ id: 'c', userId: 'u2', score: 900, endedAt: 3 }));
    lb.record(sess({ id: 'd', userId: 'u3', score: 100, status: 'rejected' }));
    expect(lb.top('memory').map((e) => [e.userId, e.score, e.rank])).toEqual([['u1', 900, 1], ['u2', 900, 2]]);
  });
  // EN: Case — void recomputes.
  // ES: Caso — anular recalcula.
  it('void recomputes / anular recalcula', () => {
    const lb = new Leaderboards();
    lb.record(sess({ id: 'a', userId: 'u1', score: 500 }));
    lb.record(sess({ id: 'b', userId: 'u1', score: 900 }));
    lb.record(sess({ id: 'b', status: 'voided' }));
    expect(lb.top('memory')[0]!.score).toBe(500);
  });
  // EN: Case — idempotent.
  // ES: Caso — idempotente.
  it('idempotent / idempotente', () => {
    const lb = new Leaderboards();
    expect(lb.record(sess({ id: 'a', score: 1 }))).toBe(true);
    expect(lb.record(sess({ id: 'a', score: 1 }))).toBe(false);
  });
  // EN: Case — erasure removes user.
  // ES: Caso — borrado quita usuario.
  it('erasure removes user / borrado quita usuario', () => {
    const lb = new Leaderboards();
    lb.record(sess({ id: 'a', userId: 'u1', score: 1 }));
    lb.removeUser('u1');
    expect(lb.top('memory')).toEqual([]);
  });
});

// EN: Suite: progression.
// ES: Suite: progresión.
describe('progression / progresión', () => {
  // EN: Case — levels.
  // ES: Caso — niveles.
  it('levels / niveles', () => { expect(levelFor(0)).toBe(1); expect(levelFor(100)).toBe(2); expect(levelFor(400)).toBe(3); });
  // EN: Case — unlocks achievements once.
  // ES: Caso — desbloquea logros una vez.
  it('unlocks achievements once / desbloquea logros una vez', () => {
    const p = new Progression();
    const seen = new Set<string>();
    expect(p.apply(sess({ id: '1', score: 950 }), 1000, seen)).toEqual(['first_game', 'memory_master']);
    expect(p.apply(sess({ id: '1', score: 950 }), 1000, seen)).toEqual([]);
    p.apply(sess({ id: '2', gameId: 'reaction', score: 850 }), 1000, seen);
    expect(p.apply(sess({ id: '3', gameId: 'merge2048', score: 1200 }), 1e6, seen)).toEqual(expect.arrayContaining(['explorer', 'tile_1000']));
    expect(p.get('u').gamesPlayed).toEqual({ memory: 1, reaction: 1, merge2048: 1 });
  });
  // EN: Case — ignores non-accepted.
  // ES: Caso — ignora no aceptadas.
  it('ignores non-accepted / ignora no aceptadas', () => expect(new Progression().apply(sess({ status: 'held' }), 1000)).toEqual([]));
});
