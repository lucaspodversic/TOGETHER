/**
 * EN: Password hashing with Node's built-in scrypt (memory-hard KDF, no native deps).
 *     Format: "scrypt$N$r$p$saltB64$hashB64" so parameters can be upgraded later.
 * ES: Hash de contraseñas con scrypt nativo de Node (KDF de memoria dura, sin dependencias nativas).
 *     Formato: "scrypt$N$r$p$saltB64$hashB64" para poder subir parámetros más adelante.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// EN: Default cost parameters (OWASP-recommended baseline for scrypt).
// ES: Parámetros de costo por defecto (base recomendada por OWASP para scrypt).
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

/**
 * EN: Minimum password policy: length 10..128. Length beats composition rules.
 * ES: Política mínima: longitud 10..128. La longitud importa más que reglas de composición.
 */
export function validatePasswordPolicy(pw: string): string | null {
  // EN: Return a reason string, or null when the password is acceptable.
  // ES: Devuelve un motivo, o null cuando la contraseña es aceptable.
  if (typeof pw !== 'string') return 'password_required';
  if (pw.length < 10) return 'password_too_short';
  if (pw.length > 128) return 'password_too_long';
  return null;
}

/** EN: Hash a password with a fresh random salt. / ES: Hashea una contraseña con sal aleatoria nueva. */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * EN: Constant-time verification. Malformed stored hashes simply fail (never throw to callers).
 * ES: Verificación en tiempo constante. Hashes guardados malformados fallan (nunca lanzan).
 */
export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64');
  // EN: Recompute with the parameters stored alongside the hash.
  // ES: Recalcular con los parámetros guardados junto al hash.
  const actual = scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
