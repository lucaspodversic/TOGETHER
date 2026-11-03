/**
 * EN: Achievements and progression (XP → level). Pure rules evaluated from accepted sessions.
 *     Achievements are cosmetic/non-monetary. An optional on-chain soulbound badge mirror exists
 *     in 06-web3 but is gated by FEATURE_NFT_MINT.
 * ES: Logros y progresión (XP → nivel). Reglas puras evaluadas desde sesiones aceptadas.
 *     Los logros son cosméticos/no monetarios. Existe un espejo opcional como insignia soulbound
 *     on-chain en 06-web3, detrás de FEATURE_NFT_MINT.
 */
import type { GameSession } from './sessions.js';

export interface PlayerProgress {
  xp: number;
  gamesPlayed: Record<string, number>;
  best: Record<string, number>;
  unlocked: string[];
}

export interface AchievementDef {
  id: string;
  title: { en: string; es: string };
  test: (p: PlayerProgress, s: GameSession) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_game', title: { en: 'First game', es: 'Primera partida' }, test: (p) => Object.values(p.gamesPlayed).reduce((a, b) => a + b, 0) >= 1 },
  { id: 'explorer', title: { en: 'Played all games', es: 'Probó todos los juegos' }, test: (p) => Object.keys(p.gamesPlayed).length >= 3 },
  { id: 'memory_master', title: { en: 'Memory: perfect-ish (≥900)', es: 'Memotest: casi perfecto (≥900)' }, test: (_p, s) => s.gameId === 'memory' && (s.score ?? 0) >= 900 },
  { id: 'lightning', title: { en: 'Reaction ≥ 800', es: 'Reflejos ≥ 800' }, test: (_p, s) => s.gameId === 'reaction' && (s.score ?? 0) >= 800 },
  { id: 'tile_1000', title: { en: '2048: 1000 points', es: '2048: 1000 puntos' }, test: (_p, s) => s.gameId === 'merge2048' && (s.score ?? 0) >= 1000 },
  { id: 'dedicated', title: { en: '10 games played', es: '10 partidas jugadas' }, test: (p) => Object.values(p.gamesPlayed).reduce((a, b) => a + b, 0) >= 10 },
];

/** EN: Level curve: level n needs 100·n² XP. / ES: Curva de nivel: el nivel n requiere 100·n² XP. */
export const levelFor = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;

/** EN: XP for a session: 10 base + score share capped. / ES: XP por sesión: 10 base + parte del puntaje con tope. */
export const xpFor = (s: GameSession, maxScore: number) => 10 + Math.min(40, Math.floor((40 * (s.score ?? 0)) / Math.max(1, maxScore)));

export class Progression {
  private readonly players = new Map<string, PlayerProgress>();

  get(userId: string): PlayerProgress & { level: number } {
    const p = this.players.get(userId) ?? { xp: 0, gamesPlayed: {}, best: {}, unlocked: [] };
    return { ...p, level: levelFor(p.xp) };
  }

  /**
   * EN: Apply an accepted session; returns newly unlocked achievement ids. Idempotent per session.
   * ES: Aplica una sesión aceptada; devuelve ids de logros nuevos. Idempotente por sesión.
   */
  apply(s: GameSession, maxScore: number, seen = new Set<string>()): string[] {
    if (s.status !== 'accepted' || seen.has(s.id)) return [];
    seen.add(s.id);
    const p = this.players.get(s.userId) ?? { xp: 0, gamesPlayed: {}, best: {}, unlocked: [] };
    p.xp += xpFor(s, maxScore);
    p.gamesPlayed[s.gameId] = (p.gamesPlayed[s.gameId] ?? 0) + 1;
    p.best[s.gameId] = Math.max(p.best[s.gameId] ?? 0, s.score ?? 0);
    const fresh = ACHIEVEMENTS.filter((a) => !p.unlocked.includes(a.id) && a.test(p, s)).map((a) => a.id);
    p.unlocked.push(...fresh);
    this.players.set(s.userId, p);
    return fresh;
  }
}
