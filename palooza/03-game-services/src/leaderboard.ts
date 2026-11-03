/**
 * EN: Per-game leaderboards keeping each player's BEST accepted score. Ties go to whoever got
 *     the score first. Voided sessions are removed and the next best is recomputed.
 * ES: Rankings por juego con el MEJOR puntaje aceptado de cada jugador. Los empates los gana quien
 *     logró el puntaje primero. Las sesiones anuladas se quitan y se recalcula el siguiente mejor.
 */
import type { GameSession } from './sessions.js';

export interface LeaderboardEntry { userId: string; score: number; at: number; sessionId: string }

export class Leaderboards {
  // EN: gameId → all accepted results (kept to allow recompute on void).
  // ES: gameId → todos los resultados aceptados (se guardan para recalcular al anular).
  private readonly results = new Map<string, LeaderboardEntry[]>();

  /** EN: Feed a finished session; returns true if the board changed. / ES: Alimenta una sesión; true si cambió el ranking. */
  record(s: GameSession): boolean {
    const list = this.results.get(s.gameId) ?? [];
    this.results.set(s.gameId, list);
    if (s.status === 'voided') {
      const before = list.length;
      const kept = list.filter((e) => e.sessionId !== s.id);
      this.results.set(s.gameId, kept);
      return kept.length !== before;
    }
    if (s.status !== 'accepted' || s.score === undefined) return false;
    if (list.some((e) => e.sessionId === s.id)) return false;
    list.push({ userId: s.userId, score: s.score, at: s.endedAt ?? s.startedAt, sessionId: s.id });
    return true;
  }

  /** EN: Top N, best per user. / ES: Top N, mejor por usuario. */
  top(gameId: string, n = 10): (LeaderboardEntry & { rank: number })[] {
    const best = new Map<string, LeaderboardEntry>();
    for (const e of this.results.get(gameId) ?? []) {
      const cur = best.get(e.userId);
      if (!cur || e.score > cur.score || (e.score === cur.score && e.at < cur.at)) best.set(e.userId, e);
    }
    return [...best.values()]
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, n)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  /** EN: A user's accepted scores (oldest first). / ES: Puntajes aceptados de un usuario. */
  scoresOf(gameId: string, userId: string): number[] {
    return (this.results.get(gameId) ?? []).filter((e) => e.userId === userId).map((e) => e.score);
  }

  /** EN: Remove a user (erasure). / ES: Quita a un usuario (borrado). */
  removeUser(userId: string): void {
    for (const [g, list] of this.results) this.results.set(g, list.filter((e) => e.userId !== userId));
  }
}
