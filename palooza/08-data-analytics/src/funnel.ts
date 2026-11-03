/**
 * EN: Funnel + engagement metrics: ordered-step conversion per user, D1 retention, and per-game
 *     completion rates. Pure functions over validated events.
 * ES: Métricas de embudo + engagement: conversión por pasos ordenados por usuario, retención D1 y
 *     tasa de finalización por juego. Funciones puras sobre eventos validados.
 */
import type { AnalyticsEvent, EventName } from './schema.js';

export const DEFAULT_FUNNEL: EventName[] = ['signup_started', 'signup_completed', 'eligibility_passed', 'game_started', 'game_completed', 'wallet_linked'];

export interface FunnelStep { step: EventName; users: number; conversionFromPrev: number; conversionFromStart: number }

/**
 * EN: A user counts for step k only if they did steps 0..k in chronological order.
 * ES: Un usuario cuenta en el paso k solo si hizo los pasos 0..k en orden cronológico.
 */
export function funnel(events: AnalyticsEvent[], steps = DEFAULT_FUNNEL): FunnelStep[] {
  const byUser = new Map<string, AnalyticsEvent[]>();
  for (const e of events) (byUser.get(e.anonId) ?? byUser.set(e.anonId, []).get(e.anonId)!).push(e);
  const counts = steps.map(() => 0);
  for (const evs of byUser.values()) {
    evs.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    let k = 0;
    for (const e of evs) if (k < steps.length && e.name === steps[k]) counts[k++]!++;
  }
  return steps.map((step, i) => ({
    step,
    users: counts[i]!,
    conversionFromPrev: i === 0 ? 1 : counts[i - 1] ? counts[i]! / counts[i - 1]! : 0,
    conversionFromStart: counts[0] ? counts[i]! / counts[0] : 0,
  }));
}

/** EN: Share of users active on day 0 who return on day 1 (UTC). / ES: Proporción que vuelve al día 1 (UTC). */
export function d1Retention(events: AnalyticsEvent[]): number {
  const days = new Map<string, Set<string>>();
  for (const e of events) (days.get(e.anonId) ?? days.set(e.anonId, new Set()).get(e.anonId)!).add(e.ts.slice(0, 10));
  let cohort = 0, retained = 0;
  for (const set of days.values()) {
    const first = [...set].sort()[0]!;
    cohort++;
    const next = new Date(Date.parse(`${first}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    if (set.has(next)) retained++;
  }
  return cohort ? retained / cohort : 0;
}

/** EN: started vs completed(accepted) per game. / ES: iniciadas vs completadas(aceptadas) por juego. */
export function completionByGame(events: AnalyticsEvent[]): Record<string, { started: number; accepted: number; rate: number }> {
  const out: Record<string, { started: number; accepted: number; rate: number }> = {};
  for (const e of events) {
    const g = String(e.props.gameId ?? '');
    if (!g) continue;
    out[g] ??= { started: 0, accepted: 0, rate: 0 };
    if (e.name === 'game_started') out[g].started++;
    if (e.name === 'game_completed' && e.props.status === 'accepted') out[g].accepted++;
  }
  for (const v of Object.values(out)) v.rate = v.started ? v.accepted / v.started : 0;
  return out;
}

/** EN: Render a plain-text report. / ES: Genera un reporte en texto plano. */
export function renderReport(events: AnalyticsEvent[]): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const lines = ['FUNNEL / EMBUDO'];
  for (const s of funnel(events)) lines.push(`  ${s.step.padEnd(20)} ${String(s.users).padStart(5)}  prev ${pct(s.conversionFromPrev).padStart(6)}  start ${pct(s.conversionFromStart).padStart(6)}`);
  lines.push(`D1 retention / retención D1: ${pct(d1Retention(events))}`);
  lines.push('COMPLETION BY GAME / FINALIZACIÓN POR JUEGO');
  for (const [g, v] of Object.entries(completionByGame(events))) lines.push(`  ${g.padEnd(12)} ${v.accepted}/${v.started} (${pct(v.rate)})`);
  return lines.join('\n');
}
