/**
 * EN: Declarative reward rules. Rules are data (versioned) so they can be reviewed, diffed and
 *     audited; evaluation is a pure function. Points are NON-monetary play points: they cannot be
 *     bought, sold, transferred or cashed out.
 * ES: Reglas de recompensa declarativas. Las reglas son datos (versionados) para poder revisarlas,
 *     compararlas y auditarlas; la evaluación es una función pura. Los puntos son puntos de juego NO
 *     monetarios: no se compran, venden, transfieren ni canjean por dinero.
 */
export interface RewardEvent {
  type: 'session_accepted' | 'achievement_unlocked' | 'daily_login';
  userId: string;
  ref: string; // EN: unique source id (session/achievement/date) / ES: id único de origen
  gameId?: string;
  score?: number;
  at: number; // EN: ms epoch / ES: ms epoch
}

export interface RewardRule {
  id: string;
  version: number;
  description: { en: string; es: string };
  on: RewardEvent['type'];
  gameId?: string;
  minScore?: number;
  points: number;
  // EN: Max points this rule can grant per user per UTC day. / ES: Máximo de puntos por usuario por día UTC.
  dailyCap?: number;
  active: boolean;
}

export const DEFAULT_RULES: RewardRule[] = [
  { id: 'play', version: 1, description: { en: '5 pts per accepted game', es: '5 pts por partida aceptada' }, on: 'session_accepted', points: 5, dailyCap: 100, active: true },
  { id: 'memory_high', version: 1, description: { en: '+20 for memory ≥ 900', es: '+20 por memotest ≥ 900' }, on: 'session_accepted', gameId: 'memory', minScore: 900, points: 20, dailyCap: 60, active: true },
  { id: 'reaction_high', version: 1, description: { en: '+20 for reaction ≥ 800', es: '+20 por reflejos ≥ 800' }, on: 'session_accepted', gameId: 'reaction', minScore: 800, points: 20, dailyCap: 60, active: true },
  { id: 'achievement', version: 1, description: { en: '50 per achievement', es: '50 por logro' }, on: 'achievement_unlocked', points: 50, active: true },
  { id: 'daily', version: 1, description: { en: '10 daily login', es: '10 por ingreso diario' }, on: 'daily_login', points: 10, dailyCap: 10, active: true },
];

/** EN: UTC day key. / ES: Clave de día UTC. */
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** EN: Validate a rule set (no duplicates, sane values). / ES: Valida un set de reglas. */
export function validateRules(rules: RewardRule[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) errs.push(`duplicate:${r.id}`);
    ids.add(r.id);
    if (!Number.isInteger(r.points) || r.points <= 0 || r.points > 1000) errs.push(`points:${r.id}`);
    if (r.dailyCap !== undefined && r.dailyCap < r.points) errs.push(`cap:${r.id}`);
  }
  return errs;
}

/**
 * EN: Which rules match an event (before caps). / ES: Qué reglas aplican a un evento (antes de topes).
 */
export function matchRules(ev: RewardEvent, rules: RewardRule[]): RewardRule[] {
  return rules.filter((r) => r.active && r.on === ev.type && (!r.gameId || r.gameId === ev.gameId) && (r.minScore === undefined || (ev.score ?? -1) >= r.minScore));
}
