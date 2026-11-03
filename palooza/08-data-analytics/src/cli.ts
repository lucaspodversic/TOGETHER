/**
 * EN: CLI: `tsx src/cli.ts <events.jsonl>` → quality report + funnel report. Exit 1 on DQ failure.
 *     Without a file it uses synthetic data.
 * ES: CLI: `tsx src/cli.ts <eventos.jsonl>` → reporte de calidad + embudo. Sale con 1 si falla la calidad.
 *     Sin archivo usa datos sintéticos.
 */
import { readFileSync } from 'node:fs';
import { renderReport } from './funnel.js';
import { checkQuality } from './quality.js';
import type { AnalyticsEvent } from './schema.js';
import { syntheticEvents } from './synthetic.js';

const file = process.argv[2];
const events: AnalyticsEvent[] = file ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : syntheticEvents();
const q = checkQuality(events, Date.parse('2030-01-01'));
console.log('DATA QUALITY / CALIDAD DE DATOS', JSON.stringify(q, null, 2));
console.log(renderReport(events));
process.exit(q.passed ? 0 : 1);
