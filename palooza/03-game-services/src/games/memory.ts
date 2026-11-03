/**
 * EN: "Memory Match": 8 pairs on a 4x4 board. Input = list of flipped card indices, in pairs.
 *     Score = 1000 − 25·(extra attempts) − elapsed penalty is NOT applied server-side here to keep
 *     scoring time-independent and reproducible; fewer attempts ⇒ higher score.
 * ES: "Memory Match": 8 pares en un tablero 4x4. Input = lista de índices de cartas volteadas, de a pares.
 *     Puntaje = 1000 − 25·(intentos extra); no se usa el tiempo para que el puntaje sea reproducible;
 *     menos intentos ⇒ más puntaje.
 */
import { mulberry32, seedFrom, shuffle } from '../rng.js';
import type { GameDefinition, ReplayResult } from './types.js';

export const MEMORY_PAIRS = 8;

/** EN: Board layout derived from the seed. / ES: Layout del tablero derivado de la semilla. */
export function memoryBoard(seed: string): number[] {
  const symbols = Array.from({ length: MEMORY_PAIRS }, (_, i) => [i, i]).flat();
  return shuffle(symbols, mulberry32(seedFrom(`memory:${seed}`)));
}

/** EN: Score formula, shared by UI preview and server. / ES: Fórmula de puntaje compartida por UI y servidor. */
export const memoryScore = (attempts: number) => Math.max(100, 1000 - 25 * Math.max(0, attempts - MEMORY_PAIRS));

export const memoryGame: GameDefinition<{ flips: number[] }> = {
  id: 'memory',
  name: { en: 'Memory Match', es: 'Memotest' },
  kind: 'casual',
  maxScore: 1000,
  minDurationMs: 4000,
  maxInputs: 200,
  replay(seed, input): ReplayResult {
    const flips = input?.flips;
    if (!Array.isArray(flips) || flips.length % 2 !== 0) return { valid: false, score: 0, completed: false, reason: 'flips_must_be_pairs' };
    const board = memoryBoard(seed);
    const matched = new Set<number>();
    let attempts = 0;
    for (let i = 0; i < flips.length; i += 2) {
      const a = flips[i]!;
      const b = flips[i + 1]!;
      // EN: Reject out-of-range, same-card, or already-matched flips. / ES: Rechaza fuera de rango, misma carta o ya emparejadas.
      if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x < board.length)) return { valid: false, score: 0, completed: false, reason: 'index_out_of_range' };
      if (a === b || matched.has(a) || matched.has(b)) return { valid: false, score: 0, completed: false, reason: 'illegal_flip' };
      attempts++;
      if (board[a] === board[b]) matched.add(a).add(b);
    }
    const completed = matched.size === board.length;
    // EN: Incomplete runs score 0 (no partial credit). / ES: Partidas incompletas puntúan 0 (sin crédito parcial).
    return { valid: true, completed, score: completed ? memoryScore(attempts) : 0, stats: { attempts } };
  },
};
