/**
 * EN: Pure UI helpers for progression and game clients (tested in Node).
 * ES: Helpers de UI puros para progresión y clientes de juego (testeados en Node).
 */
import { levelFor } from '@palooza/game-services/browser';

/** EN: XP needed to reach a level (inverse of levelFor). / ES: XP necesaria para un nivel (inversa de levelFor). */
export const xpForLevel = (level: number) => 100 * (level - 1) ** 2;

/** EN: Fraction (0..1) towards next level. / ES: Fracción (0..1) hacia el próximo nivel. */
export function levelProgress(xp: number): { level: number; pct: number; next: number } {
  const level = levelFor(xp);
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  return { level, pct: Math.min(1, (xp - lo) / (hi - lo)), next: hi };
}

/**
 * EN: Memory client state machine. Records every flip pair (that is what the server replays).
 * ES: Máquina de estados del memotest. Registra cada par volteado (es lo que el servidor reproduce).
 */
export interface MemoryState { board: number[]; open: number[]; matched: number[]; flips: number[]; attempts: number }

export const memoryInit = (board: number[]): MemoryState => ({ board, open: [], matched: [], flips: [], attempts: 0 });

// EN: `memoryFlip` — see file header for its role in the flow.
// ES: `memoryFlip` — ver encabezado del archivo para su papel en el flujo.
export function memoryFlip(s: MemoryState, idx: number): MemoryState {
  // EN: Ignore invalid clicks (already open/matched, or a pair is showing). / ES: Ignora clics inválidos.
  if (s.matched.includes(idx) || s.open.includes(idx) || s.open.length >= 2 || idx < 0 || idx >= s.board.length) return s;
  const open = [...s.open, idx];
  const flips = [...s.flips, idx];
  if (open.length < 2) return { ...s, open, flips };
  const [a, b] = open as [number, number];
  const hit = s.board[a] === s.board[b];
  return { ...s, open: hit ? [] : open, matched: hit ? [...s.matched, a, b] : s.matched, flips, attempts: s.attempts + 1 };
}

/** EN: Close a non-matching pair. / ES: Cierra un par que no coincide. */
export const memoryHide = (s: MemoryState): MemoryState => ({ ...s, open: [] });
export const memoryDone = (s: MemoryState) => s.matched.length === s.board.length;

/** EN: Map keyboard keys to 2048 moves. / ES: Mapea teclas a movimientos de 2048. */
export const KEY_TO_MOVE: Record<string, 'U' | 'D' | 'L' | 'R'> = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R' };
