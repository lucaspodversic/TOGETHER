/**
 * EN: "Merge 2048" engine: 4x4 board, seeded tile spawns. Input = list of moves (U/D/L/R).
 *     The server replays every move; score = sum of merged tile values (classic rule).
 * ES: Motor "Merge 2048": tablero 4x4, aparición de fichas con semilla. Input = lista de jugadas (U/D/L/R).
 *     El servidor reproduce cada jugada; puntaje = suma de fichas fusionadas (regla clásica).
 */
import { mulberry32, seedFrom } from '../rng.js';
import type { GameDefinition, ReplayResult } from './types.js';

export type Move = 'U' | 'D' | 'L' | 'R';
export type Board = number[]; // EN: 16 cells, row-major, 0 = empty / ES: 16 celdas, por filas, 0 = vacía

export interface State2048 { board: Board; score: number; rnd: () => number; over: boolean }

/** EN: Spawn a 2 (90%) or 4 (10%) on a random empty cell. / ES: Genera un 2 (90%) o 4 (10%) en celda vacía. */
function spawn(s: State2048): void {
  const empty = s.board.flatMap((v, i) => (v === 0 ? [i] : []));
  if (!empty.length) return;
  const idx = empty[Math.floor(s.rnd() * empty.length)]!;
  s.board[idx] = s.rnd() < 0.9 ? 2 : 4;
}

/** EN: New game: empty board + two spawns. / ES: Partida nueva: tablero vacío + dos fichas. */
export function new2048(seed: string): State2048 {
  const s: State2048 = { board: Array(16).fill(0), score: 0, rnd: mulberry32(seedFrom(`2048:${seed}`)), over: false };
  spawn(s);
  spawn(s);
  return s;
}

/** EN: Slide+merge one line toward index 0. / ES: Desliza+fusiona una línea hacia el índice 0. */
function slideLine(line: number[]): { out: number[]; gained: number } {
  const vals = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    // EN: Each tile merges at most once per move. / ES: Cada ficha se fusiona como máximo una vez por jugada.
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i]! * 2);
      gained += vals[i]! * 2;
      i++;
    } else out.push(vals[i]!);
  }
  while (out.length < 4) out.push(0);
  return { out, gained };
}

// EN: Cell indices for each line, ordered toward the move direction.
// ES: Índices de celdas de cada línea, ordenados hacia la dirección de la jugada.
function lines(move: Move): number[][] {
  const res: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const row = [0, 1, 2, 3].map((c) => k * 4 + c);
    const col = [0, 1, 2, 3].map((r) => r * 4 + k);
    res.push(move === 'L' ? row : move === 'R' ? row.reverse() : move === 'U' ? col : col.reverse());
  }
  return res;
}

/** EN: True if any move changes the board. / ES: True si alguna jugada cambia el tablero. */
export function canMove(board: Board): boolean {
  return (['U', 'D', 'L', 'R'] as Move[]).some((m) => lines(m).some((idx) => {
    const line = idx.map((i) => board[i]!);
    return slideLine(line).out.some((v, j) => v !== line[j]);
  }));
}

/**
 * EN: Apply a move. Returns false when the move changes nothing (no spawn then, like the original).
 * ES: Aplica una jugada. Devuelve false si no cambia nada (entonces no aparece ficha, como el original).
 */
export function apply2048(s: State2048, move: Move): boolean {
  let changed = false;
  for (const idx of lines(move)) {
    const line = idx.map((i) => s.board[i]!);
    const { out, gained } = slideLine(line);
    out.forEach((v, j) => {
      if (s.board[idx[j]!] !== v) changed = true;
      s.board[idx[j]!] = v;
    });
    s.score += gained;
  }
  if (changed) spawn(s);
  s.over = !canMove(s.board);
  return changed;
}

export const game2048: GameDefinition<{ moves: string }> = {
  id: 'merge2048',
  name: { en: 'Merge 2048', es: 'Fusión 2048' },
  kind: 'casual',
  // EN: Practical cap for anti-abuse (a 65536 tile run scores ~ 1.3M). / ES: Tope práctico anti-abuso.
  maxScore: 1_500_000,
  minDurationMs: 0,
  maxInputs: 20_000,
  replay(seed, input): ReplayResult {
    const moves = input?.moves;
    if (typeof moves !== 'string' || !/^[UDLR]*$/.test(moves)) return { valid: false, score: 0, completed: false, reason: 'bad_moves' };
    const s = new2048(seed);
    let noop = 0;
    for (const m of moves) {
      if (s.over) return { valid: false, score: 0, completed: false, reason: 'moves_after_game_over' };
      if (!apply2048(s, m as Move)) noop++;
    }
    return { valid: true, score: s.score, completed: s.over, stats: { moves: moves.length, noop, maxTile: Math.max(...s.board) } };
  },
};
