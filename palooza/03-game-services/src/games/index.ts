/**
 * EN: Game registry. Casino-style games are intentionally NOT registered: they would be gated by
 *     the FEATURE_CASINO_GAMES flag (default off) and still need legal review; see 01-discovery.
 * ES: Registro de juegos. Los juegos estilo casino NO se registran a propósito: estarían detrás del
 *     flag FEATURE_CASINO_GAMES (apagado por defecto) y requieren revisión legal; ver 01-discovery.
 */
import { game2048 } from './g2048.js';
import { memoryGame } from './memory.js';
import { reactionGame } from './reaction.js';
import type { GameDefinition } from './types.js';

export * from './types.js';
export * from './memory.js';
export * from './g2048.js';
export * from './reaction.js';

export const GAMES: Record<string, GameDefinition<any>> = {
  [memoryGame.id]: memoryGame,
  [reactionGame.id]: reactionGame,
  [game2048.id]: game2048,
};

/** EN: Public catalogue entries (no functions). / ES: Entradas públicas del catálogo (sin funciones). */
export const catalogue = () => Object.values(GAMES).map(({ id, name, kind, maxScore }) => ({ id, name, kind, maxScore }));
