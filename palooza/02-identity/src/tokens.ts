/**
 * EN: Stateless signed session tokens (HMAC-SHA256, JWT-like but minimal) and single-use
 *     account-recovery tokens (only the SHA-256 of the token is stored server-side).
 * ES: Tokens de sesión firmados sin estado (HMAC-SHA256, estilo JWT pero mínimo) y tokens de
 *     recuperación de cuenta de un solo uso (en el servidor solo se guarda el SHA-256 del token).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Role } from './rbac.js';

/** EN: Claims carried by a session token. / ES: Claims que lleva un token de sesión. */
export interface SessionClaims {
  sub: string; // EN: user id / ES: id de usuario
  role: Role;
  sid: string; // EN: session id (for revocation) / ES: id de sesión (para revocar)
  exp: number; // EN: expiry, unix seconds / ES: expiración, segundos unix
}

// EN: base64url helpers (no padding). / ES: helpers base64url (sin relleno).
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** EN: Rejects weak secrets early. / ES: Rechaza secretos débiles desde el inicio. */
export function assertSecret(secret: string): void {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 chars');
}

/** EN: Sign claims into "payload.signature". / ES: Firma claims como "payload.firma". */
export function signSession(claims: SessionClaims, secret: string): string {
  assertSecret(secret);
  const payload = b64u(JSON.stringify(claims));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * EN: Verify signature + expiry. Returns null on ANY problem (no detail leaks to clients).
 * ES: Verifica firma + expiración. Devuelve null ante CUALQUIER problema (sin filtrar detalles).
 */
export function verifySession(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): SessionClaims | null {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  // EN: Constant-time compare to avoid timing oracles. / ES: Comparación en tiempo constante.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionClaims;
    if (typeof claims.exp !== 'number' || claims.exp <= nowSec) return null;
    return claims;
  } catch {
    return null;
  }
}

/** EN: Random opaque id. / ES: Id opaco aleatorio. */
export const randomId = (bytes = 16) => randomBytes(bytes).toString('base64url');

/** EN: SHA-256 hex helper. / ES: Helper SHA-256 en hex. */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * EN: Recovery token store. The raw token is given to the user (e.g. by email, out of scope here);
 *     we keep only its hash, an expiry, and a used flag → single use, short-lived.
 * ES: Almacén de tokens de recuperación. El token crudo se entrega al usuario (p. ej. por email,
 *     fuera de alcance); guardamos solo su hash, expiración y si se usó → un solo uso, vida corta.
 */
export class RecoveryTokens {
  private readonly byHash = new Map<string, { userId: string; exp: number; used: boolean }>();
  constructor(private readonly ttlMs = 15 * 60_000) {}

  /** EN: Issue a token for a user. / ES: Emite un token para un usuario. */
  issue(userId: string, now = Date.now()): string {
    const raw = randomId(32);
    this.byHash.set(sha256(raw), { userId, exp: now + this.ttlMs, used: false });
    return raw;
  }

  /** EN: Consume a token; returns the user id or null. / ES: Consume un token; devuelve el id o null. */
  consume(raw: string, now = Date.now()): string | null {
    const rec = this.byHash.get(sha256(raw));
    if (!rec || rec.used || rec.exp <= now) return null;
    // EN: Mark used before returning so a replay fails. / ES: Marcar usado antes de devolver para que un replay falle.
    rec.used = true;
    return rec.userId;
  }
}
