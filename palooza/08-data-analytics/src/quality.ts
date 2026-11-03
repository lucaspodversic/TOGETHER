/**
 * EN: Batch data-quality checks: schema validity, duplicates, future timestamps, out-of-order
 *     per-user sequences (completed before started), and volume anomalies.
 * ES: Chequeos de calidad por lote: validez de esquema, duplicados, timestamps futuros, secuencias
 *     fuera de orden por usuario (completado antes de iniciado) y anomalías de volumen.
 */
import { validateEvent, type AnalyticsEvent } from './schema.js';

export interface QualityReport {
  total: number;
  valid: number;
  duplicates: number;
  future: number;
  orphanCompletions: number;
  errorsByCode: Record<string, number>;
  passed: boolean;
}

/**
 * EN: `maxErrorRate` = tolerated share of bad rows before the batch fails (default 1%).
 * ES: `maxErrorRate` = proporción tolerada de filas malas antes de fallar el lote (1% por defecto).
 */
export function checkQuality(events: Partial<AnalyticsEvent>[], now = Date.now(), maxErrorRate = 0.01): QualityReport {
  const errorsByCode: Record<string, number> = {};
  const ids = new Set<string>();
  let valid = 0, duplicates = 0, future = 0, orphanCompletions = 0;
  const started = new Map<string, number>(); // EN: anonId|gameId → open starts / ES: inicios abiertos
  const sorted = [...events].sort((a, b) => Date.parse(a.ts ?? '') - Date.parse(b.ts ?? ''));
  for (const e of sorted) {
    const errs = validateEvent(e);
    for (const c of errs) errorsByCode[c] = (errorsByCode[c] ?? 0) + 1;
    if (e.eventId && ids.has(e.eventId)) duplicates++;
    if (e.eventId) ids.add(e.eventId);
    // EN: 5-minute clock skew tolerance. / ES: Tolerancia de 5 minutos de desfase de reloj.
    if (e.ts && Date.parse(e.ts) > now + 5 * 60_000) future++;
    if (!errs.length) valid++;
    const key = `${e.anonId}|${e.props?.gameId}`;
    if (e.name === 'game_started') started.set(key, (started.get(key) ?? 0) + 1);
    if (e.name === 'game_completed') {
      const n = started.get(key) ?? 0;
      if (n <= 0) orphanCompletions++;
      else started.set(key, n - 1);
    }
  }
  const total = events.length;
  const bad = total - valid + duplicates + future + orphanCompletions;
  return { total, valid, duplicates, future, orphanCompletions, errorsByCode, passed: total > 0 && bad / total <= maxErrorRate };
}
