// EN: Game engine tests (server replay is the source of truth). / ES: Tests de motores (la reproducción en servidor manda).
import { describe, expect, it } from 'vitest';
import { apply2048, canMove, catalogue, game2048, memoryBoard, memoryGame, memoryScore, mulberry32, new2048, reactionDelays, reactionGame, roundPoints, seedFrom, shuffle } from '../src/index.js';

// EN: Perfect memory solver (knows the board) → minimal attempts. / ES: Resolutor perfecto (conoce el tablero).
export function perfectFlips(seed: string): number[] {
  const b = memoryBoard(seed);
  const flips: number[] = [];
  for (let sym = 0; sym < 8; sym++) flips.push(...b.flatMap((v, i) => (v === sym ? [i] : [])));
  return flips;
}

// EN: Suite: rng.
// ES: Suite: rng.
describe('rng', () => {
  // EN: Case — deterministic.
  // ES: Caso — determinista.
  it('deterministic / determinista', () => {
    const a = mulberry32(seedFrom('x'));
    const b = mulberry32(seedFrom('x'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  // EN: Case — shuffle keeps elements.
  // ES: Caso — mezcla conserva elementos.
  it('shuffle keeps elements / mezcla conserva elementos', () => expect(shuffle([1, 2, 3, 4], mulberry32(1)).sort()).toEqual([1, 2, 3, 4]));
  // EN: Case — different seeds differ.
  // ES: Caso — semillas distintas difieren.
  it('different seeds differ / semillas distintas difieren', () => expect(seedFrom('a')).not.toBe(seedFrom('b')));
});

// EN: Suite: memory.
// ES: Suite: memotest.
describe('memory / memotest', () => {
  // EN: Case — board has 8 pairs.
  // ES: Caso — tablero con 8 pares.
  it('board has 8 pairs / tablero con 8 pares', () => {
    const b = memoryBoard('s');
    expect(b).toHaveLength(16);
    for (let i = 0; i < 8; i++) expect(b.filter((x) => x === i)).toHaveLength(2);
  });
  // EN: Case — perfect run scores 1000.
  // ES: Caso — partida perfecta = 1000.
  it('perfect run scores 1000 / partida perfecta = 1000', () => expect(memoryGame.replay('s', { flips: perfectFlips('s') })).toMatchObject({ valid: true, completed: true, score: 1000 }));
  // EN: Case — extra attempts reduce score.
  // ES: Caso — intentos extra bajan puntaje.
  it('extra attempts reduce score / intentos extra bajan puntaje', () => expect(memoryScore(12)).toBe(900));
  // EN: Case — score floor 100.
  // ES: Caso — piso 100.
  it('score floor 100 / piso 100', () => expect(memoryScore(1000)).toBe(100));
  // EN: Case — incomplete scores 0.
  // ES: Caso — incompleto = 0.
  it('incomplete scores 0 / incompleto = 0', () => expect(memoryGame.replay('s', { flips: perfectFlips('s').slice(0, 4) })).toMatchObject({ valid: true, completed: false, score: 0 }));
  // EN: Case — rejects odd flips.
  // ES: Caso — rechaza flips impares.
  it('rejects odd flips / rechaza flips impares', () => expect(memoryGame.replay('s', { flips: [1] }).valid).toBe(false));
  // EN: Case — rejects same card.
  // ES: Caso — rechaza misma carta.
  it('rejects same card / rechaza misma carta', () => expect(memoryGame.replay('s', { flips: [1, 1] }).reason).toBe('illegal_flip'));
  // EN: Case — rejects re-flipping matched.
  // ES: Caso — rechaza volver a voltear emparejadas.
  it('rejects re-flipping matched / rechaza volver a voltear emparejadas', () => {
    const f = perfectFlips('s');
    expect(memoryGame.replay('s', { flips: [...f.slice(0, 2), ...f.slice(0, 2)] }).valid).toBe(false);
  });
  // EN: Case — rejects out of range.
  // ES: Caso — rechaza fuera de rango.
  it('rejects out of range / rechaza fuera de rango', () => expect(memoryGame.replay('s', { flips: [0, 99] }).reason).toBe('index_out_of_range'));
  // EN: Case — rejects missing input.
  // ES: Caso — rechaza input faltante.
  it('rejects missing input / rechaza input faltante', () => expect(memoryGame.replay('s', undefined as never).valid).toBe(false));
});

// EN: Suite: 2048.
// ES: Suite: 2048.
describe('2048', () => {
  // EN: Case — starts with two tiles.
  // ES: Caso — arranca con dos fichas.
  it('starts with two tiles / arranca con dos fichas', () => expect(new2048('a').board.filter((v) => v).length).toBe(2));
  // EN: Case — merges once per move.
  // ES: Caso — fusiona una vez por jugada.
  it('merges once per move / fusiona una vez por jugada', () => {
    const s = new2048('a');
    s.board = [2, 2, 2, 2, ...Array(12).fill(0)];
    apply2048(s, 'L');
    expect(s.board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(s.score).toBe(8);
  });
  // EN: Case — no-op move does not spawn.
  // ES: Caso — jugada nula no genera ficha.
  it('no-op move does not spawn / jugada nula no genera ficha', () => {
    const s = new2048('a');
    s.board = [2, 0, 0, 0, ...Array(12).fill(0)];
    expect(apply2048(s, 'L')).toBe(false);
    expect(s.board.filter((v) => v).length).toBe(1);
  });
  // EN: Case — detects stuck board.
  // ES: Caso — detecta tablero trabado.
  it('detects stuck board / detecta tablero trabado', () => expect(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe(false));
  // EN: Case — replay is deterministic.
  // ES: Caso — reproducción determinista.
  it('replay is deterministic / reproducción determinista', () => {
    const moves = 'LURDLURDLLUURRDD'.repeat(5);
    expect(game2048.replay('seed', { moves })).toEqual(game2048.replay('seed', { moves }));
  });
  // EN: Case — replay matches incremental play.
  // ES: Caso — reproducción = juego incremental.
  it('replay matches incremental play / reproducción = juego incremental', () => {
    const s = new2048('k');
    const moves = 'LDRULDRULLDD';
    for (const m of moves) apply2048(s, m as 'L');
    expect(game2048.replay('k', { moves }).score).toBe(s.score);
  });
  // EN: Case — rejects bad moves.
  // ES: Caso — rechaza jugadas inválidas.
  it('rejects bad moves / rechaza jugadas inválidas', () => expect(game2048.replay('s', { moves: 'LXR' }).valid).toBe(false));
  // EN: Case — plays to game over.
  // ES: Caso — juega hasta el final.
  it('plays to game over / juega hasta el final', () => {
    const rnd = mulberry32(7);
    const s = new2048('end');
    let moves = '';
    while (!s.over && moves.length < 5000) {
      const m = 'UDLR'[Math.floor(rnd() * 4)]!;
      apply2048(s, m as 'U');
      moves += m;
    }
    const r = game2048.replay('end', { moves });
    expect(r.completed).toBe(true);
    expect(game2048.replay('end', { moves: moves + 'L' }).reason).toBe('moves_after_game_over');
  });
});

// EN: Suite: reaction.
// ES: Suite: reflejos.
describe('reaction / reflejos', () => {
  // EN: Case — 5 delays in range.
  // ES: Caso — 5 retardos en rango.
  it('5 delays in range / 5 retardos en rango', () => {
    const d = reactionDelays('x');
    expect(d).toHaveLength(5);
    expect(d.every((x) => x >= 1000 && x < 3000)).toBe(true);
  });
  // EN: Case — points curve.
  // ES: Caso — curva de puntos.
  it('points curve / curva de puntos', () => { expect(roundPoints(100)).toBe(200); expect(roundPoints(2000)).toBe(0); });
  // EN: Case — valid run.
  // ES: Caso — partida válida.
  it('valid run / partida válida', () => expect(reactionGame.replay('x', { times: [250, 300, 280, 260, 310] })).toMatchObject({ valid: true, completed: true }));
  // EN: Case — rejects sub-human.
  // ES: Caso — rechaza sub-humano.
  it('rejects sub-human / rechaza sub-humano', () => expect(reactionGame.replay('x', { times: [50, 300, 280, 260, 310] }).reason).toBe('impossible_reaction'));
  // EN: Case — rejects wrong count.
  // ES: Caso — rechaza cantidad incorrecta.
  it('rejects wrong count / rechaza cantidad incorrecta', () => expect(reactionGame.replay('x', { times: [300] }).valid).toBe(false));
  // EN: Case — timeouts give 0.
  // ES: Caso — timeouts dan 0.
  it('timeouts give 0 / timeouts dan 0', () => expect(reactionGame.replay('x', { times: [5000, 5000, 5000, 5000, 5000] }).score).toBe(0));
});

// EN: Suite: catalogue.
// ES: Suite: catálogo.
describe('catalogue / catálogo', () => {
  // EN: Case — lists 3 games, no casino.
  // ES: Caso — lista 3 juegos, sin casino.
  it('lists 3 games, no casino / lista 3 juegos, sin casino', () => {
    const c = catalogue();
    expect(c).toHaveLength(3);
    expect(c.some((g) => g.kind === 'casino')).toBe(false);
  });
});
