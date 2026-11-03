/**
 * EN: Product analytics event schema (versioned). Events carry a PSEUDONYMOUS id (`anonId`),
 *     never emails, names, birthdates or wallet addresses (privacy by design).
 * ES: Esquema de eventos de analítica de producto (versionado). Los eventos llevan un id
 *     SEUDÓNIMO (`anonId`), nunca emails, nombres, fechas de nacimiento ni wallets (privacidad por diseño).
 */
export const SCHEMA_VERSION = 1;

// EN: Allowed event names and their required props. / ES: Eventos permitidos y sus props obligatorias.
export const EVENT_SPECS = {
  page_viewed: ['path'],
  signup_started: [],
  signup_completed: [],
  eligibility_passed: [],
  eligibility_failed: ['reason'],
  game_started: ['gameId'],
  game_completed: ['gameId', 'score', 'status'],
  achievement_unlocked: ['achievementId'],
  wallet_link_started: [],
  wallet_linked: ['chainId'],
  error_shown: ['code'],
} as const satisfies Record<string, readonly string[]>;

export type EventName = keyof typeof EVENT_SPECS;

export interface AnalyticsEvent {
  v: number;
  eventId: string; // EN: unique, for dedupe / ES: único, para deduplicar
  name: EventName;
  anonId: string;
  ts: string; // EN: ISO-8601 UTC / ES: ISO-8601 UTC
  props: Record<string, string | number | boolean>;
}

// EN: Prop keys / values that look like PII are forbidden. / ES: Claves/valores que parecen PII están prohibidos.
const PII_KEYS = /email|name|birth|phone|address|wallet|ip/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const ETH_ADDR_RE = /0x[a-fA-F0-9]{40}/;

/** EN: Validate one event; returns error codes. / ES: Valida un evento; devuelve códigos de error. */
export function validateEvent(e: Partial<AnalyticsEvent>): string[] {
  const errs: string[] = [];
  if (e.v !== SCHEMA_VERSION) errs.push('bad_version');
  if (!e.eventId) errs.push('missing_eventId');
  if (!e.anonId || !/^[a-f0-9]{8,64}$/.test(e.anonId)) errs.push('bad_anonId');
  if (!e.ts || Number.isNaN(Date.parse(e.ts))) errs.push('bad_ts');
  const spec = e.name ? (EVENT_SPECS as Record<string, readonly string[]>)[e.name] : undefined;
  if (!spec) errs.push('unknown_event');
  for (const k of spec ?? []) if (e.props?.[k] === undefined) errs.push(`missing_prop:${k}`);
  for (const [k, v] of Object.entries(e.props ?? {})) {
    if (PII_KEYS.test(k)) errs.push(`pii_key:${k}`);
    if (typeof v === 'string' && (EMAIL_RE.test(v) || ETH_ADDR_RE.test(v))) errs.push(`pii_value:${k}`);
  }
  return errs;
}
