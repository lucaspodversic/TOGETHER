/**
 * EN: Privacy-aware data handling: public projections, email masking, log redaction,
 *     pseudonymous analytics ids and data-export/erasure helpers.
 * ES: Manejo de datos con privacidad: proyecciones públicas, enmascarado de email, redacción
 *     de logs, ids seudónimos para analítica y helpers de exportación/borrado.
 */
import { createHmac } from 'node:crypto';

/** EN: Mask "lucas@example.com" → "l***@example.com". / ES: Enmascara el email. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***';
  return `${user[0]}***@${domain}`;
}

// EN: Keys that must never reach logs. / ES: Claves que nunca deben llegar a los logs.
const SENSITIVE = /pass(word)?|secret|token|authorization|cookie|birth|email|signature/i;

/** EN: Deep-redact sensitive keys for logging. / ES: Redacta en profundidad claves sensibles para logs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  return out;
}

/**
 * EN: Stable pseudonymous id for analytics (HMAC of user id with a separate salt) so the
 *     analytics store never holds the raw account id.
 * ES: Id seudónimo estable para analítica (HMAC del id con una sal aparte) para que el
 *     almacén de analítica nunca tenga el id real de la cuenta.
 */
export const pseudonymize = (userId: string, salt: string) => createHmac('sha256', salt).update(userId).digest('hex').slice(0, 24);

/** EN: Minimal user record shape used by projections. / ES: Forma mínima de usuario para proyecciones. */
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  birthDate: string;
  region: string;
  role: string;
  createdAt: string;
  passwordHash?: string;
  wallet?: string | null;
}

/** EN: What other players may see. / ES: Lo que otros jugadores pueden ver. */
export const publicProfile = (u: UserRecord) => ({ id: u.id, displayName: u.displayName, wallet: u.wallet ? `${u.wallet.slice(0, 6)}…${u.wallet.slice(-4)}` : null });

/** EN: What the owner sees (no hash). / ES: Lo que ve el dueño (sin hash). */
export function ownProfile(u: UserRecord) {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

/** EN: GDPR-style export of own data. / ES: Exportación estilo GDPR de los propios datos. */
export const exportUserData = (u: UserRecord, extra: Record<string, unknown> = {}) => ({ exportedAt: new Date().toISOString(), profile: ownProfile(u), ...extra });

/**
 * EN: Erasure: keep an anonymised tombstone so audit/leaderboard integrity holds.
 * ES: Borrado: deja una lápida anonimizada para mantener la integridad de auditoría/rankings.
 */
export const anonymize = (u: UserRecord): UserRecord => ({ ...u, email: `deleted+${u.id}@invalid`, displayName: 'deleted-player', birthDate: '1900-01-01', wallet: null, passwordHash: undefined });
