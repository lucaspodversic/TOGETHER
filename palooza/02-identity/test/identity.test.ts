// EN: Unit tests for identity primitives. / ES: Tests unitarios de primitivas de identidad.
import { describe, expect, it } from 'vitest';
import { RecoveryTokens, ageOn, anonymize, can, checkEligibility, hashPassword, maskEmail, ownProfile, pseudonymize, publicProfile, redact, signSession, validatePasswordPolicy, verifyPassword, verifySession, isRole } from '../src/index.js';

const SECRET = 'x'.repeat(40);
const user = { id: 'u1', email: 'lucas@example.com', displayName: 'Lu', birthDate: '2000-05-10', region: 'AR', role: 'player', createdAt: '2026-01-01', passwordHash: 'h', wallet: '0x1234567890abcdef1234567890abcdef12345678' };

// EN: Suite: password.
// ES: Suite: contraseña.
describe('password / contraseña', () => {
  // EN: Case — hashes and verifies.
  // ES: Caso — hashea y verifica.
  it('hashes and verifies / hashea y verifica', () => {
    const h = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', h)).toBe(true);
    expect(verifyPassword('wrong password!', h)).toBe(false);
  });
  // EN: Case — salts differ.
  // ES: Caso — sales distintas.
  it('salts differ / sales distintas', () => expect(hashPassword('aaaaaaaaaa')).not.toBe(hashPassword('aaaaaaaaaa')));
  // EN: Case — malformed hash fails.
  // ES: Caso — hash malformado falla.
  it('malformed hash fails / hash malformado falla', () => expect(verifyPassword('x', 'garbage')).toBe(false));
  // EN: Case — policy.
  // ES: Caso — política.
  it('policy / política', () => {
    expect(validatePasswordPolicy('short')).toBe('password_too_short');
    expect(validatePasswordPolicy('a'.repeat(200))).toBe('password_too_long');
    expect(validatePasswordPolicy('long enough pw')).toBeNull();
  });
});

// EN: Suite: session tokens.
// ES: Suite: tokens de sesión.
describe('session tokens / tokens de sesión', () => {
  const claims = { sub: 'u1', role: 'player' as const, sid: 's1', exp: 2_000_000_000 };
  // EN: Case — round-trips.
  // ES: Caso — ida y vuelta.
  it('round-trips / ida y vuelta', () => expect(verifySession(signSession(claims, SECRET), SECRET, 1_000)).toEqual(claims));
  // EN: Case — rejects tampering.
  // ES: Caso — rechaza manipulación.
  it('rejects tampering / rechaza manipulación', () => {
    const t = signSession(claims, SECRET);
    const forged = Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url') + '.' + t.split('.')[1];
    expect(verifySession(forged, SECRET, 1_000)).toBeNull();
  });
  // EN: Case — rejects expired.
  // ES: Caso — rechaza expirado.
  it('rejects expired / rechaza expirado', () => expect(verifySession(signSession(claims, SECRET), SECRET, 2_000_000_001)).toBeNull());
  // EN: Case — rejects weak secret.
  // ES: Caso — rechaza secreto débil.
  it('rejects weak secret / rechaza secreto débil', () => expect(() => signSession(claims, 'short')).toThrow());
  // EN: Case — rejects garbage.
  // ES: Caso — rechaza basura.
  it('rejects garbage / rechaza basura', () => expect(verifySession('abc', SECRET)).toBeNull());
});

// EN: Suite: recovery tokens.
// ES: Suite: tokens de recuperación.
describe('recovery tokens / tokens de recuperación', () => {
  // EN: Case — single use.
  // ES: Caso — un solo uso.
  it('single use / un solo uso', () => {
    const r = new RecoveryTokens();
    const t = r.issue('u1', 0);
    expect(r.consume(t, 1)).toBe('u1');
    expect(r.consume(t, 2)).toBeNull();
  });
  // EN: Case — expires.
  // ES: Caso — expira.
  it('expires / expira', () => {
    const r = new RecoveryTokens(1000);
    const t = r.issue('u1', 0);
    expect(r.consume(t, 1001)).toBeNull();
  });
  // EN: Case — unknown token.
  // ES: Caso — token desconocido.
  it('unknown token / token desconocido', () => expect(new RecoveryTokens().consume('nope')).toBeNull());
});

// EN: Suite: rbac.
// ES: Suite: rbac.
describe('rbac', () => {
  // EN: Case — player cannot freeze.
  // ES: Caso — jugador no puede congelar.
  it('player cannot freeze / jugador no puede congelar', () => expect(can('player', 'users:freeze')).toBe(false));
  // EN: Case — moderator can void scores.
  // ES: Caso — moderador puede anular puntajes.
  it('moderator can void scores / moderador puede anular puntajes', () => expect(can('moderator', 'scores:void')).toBe(true));
  // EN: Case — only admin writes flags.
  // ES: Caso — solo admin escribe flags.
  it('only admin writes flags / solo admin escribe flags', () => {
    expect(can('admin', 'flags:write')).toBe(true);
    expect(can('moderator', 'flags:write')).toBe(false);
  });
  // EN: Case — undefined role denied.
  // ES: Caso — rol indefinido denegado.
  it('undefined role denied / rol indefinido denegado', () => expect(can(undefined, 'profile:read_own')).toBe(false));
  // EN: Case — isRole.
  // ES: Caso — isRole.
  it('isRole', () => { expect(isRole('admin')).toBe(true); expect(isRole('root')).toBe(false); });
});

// EN: Suite: eligibility.
// ES: Suite: elegibilidad.
describe('eligibility / elegibilidad', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  // EN: Case — computes age.
  // ES: Caso — calcula edad.
  it('computes age / calcula edad', () => { expect(ageOn('2000-11-03', now)).toBe(25); expect(ageOn('2000-11-02', now)).toBe(26); });
  // EN: Case — blocks underage.
  // ES: Caso — bloquea menores.
  it('blocks underage / bloquea menores', () => expect(checkEligibility({ birthDate: '2015-01-01', region: 'AR' }, undefined, now)).toEqual({ ok: false, reason: 'underage' }));
  // EN: Case — allows base platform.
  // ES: Caso — permite plataforma base.
  it('allows base platform / permite plataforma base', () => expect(checkEligibility({ birthDate: '2000-01-01', region: 'ar' }, undefined, now).ok).toBe(true));
  // EN: Case — gated feature unavailable by default.
  // ES: Caso — función con compuerta no disponible por defecto.
  it('gated feature unavailable by default / función con compuerta no disponible por defecto', () =>
    expect(checkEligibility({ birthDate: '1980-01-01', region: 'US', feature: 'casino' }, undefined, now)).toEqual({ ok: false, reason: 'feature_region_unavailable' }));
  // EN: Case — blocked region.
  // ES: Caso — región bloqueada.
  it('blocked region / región bloqueada', () =>
    expect(checkEligibility({ birthDate: '1980-01-01', region: 'XX' }, { minAge: 13, blockedRegions: ['XX'] }, now).ok).toBe(false));
  // EN: Case — invalid birthdate.
  // ES: Caso — fecha inválida.
  it('invalid birthdate / fecha inválida', () => expect(checkEligibility({ birthDate: 'nope', region: 'AR' }, undefined, now)).toEqual({ ok: false, reason: 'invalid_birthdate' }));
});

// EN: Suite: privacy.
// ES: Suite: privacidad.
describe('privacy / privacidad', () => {
  // EN: Case — masks email.
  // ES: Caso — enmascara email.
  it('masks email / enmascara email', () => expect(maskEmail('lucas@example.com')).toBe('l***@example.com'));
  // EN: Case — redacts nested.
  // ES: Caso — redacta anidado.
  it('redacts nested / redacta anidado', () => expect(redact({ a: { password: 'p', ok: 1 }, list: [{ token: 't' }] })).toEqual({ a: { password: '[REDACTED]', ok: 1 }, list: [{ token: '[REDACTED]' }] }));
  // EN: Case — public profile hides PII.
  // ES: Caso — perfil público oculta PII.
  it('public profile hides PII / perfil público oculta PII', () => {
    const p = publicProfile(user);
    expect(p).not.toHaveProperty('email');
    expect(p.wallet).toBe('0x1234…5678');
  });
  // EN: Case — own profile hides hash.
  // ES: Caso — perfil propio oculta hash.
  it('own profile hides hash / perfil propio oculta hash', () => expect(ownProfile(user)).not.toHaveProperty('passwordHash'));
  // EN: Case — pseudonymize stable.
  // ES: Caso — seudónimo estable.
  it('pseudonymize stable / seudónimo estable', () => {
    expect(pseudonymize('u1', 's')).toBe(pseudonymize('u1', 's'));
    expect(pseudonymize('u1', 's')).not.toBe(pseudonymize('u1', 't'));
  });
  // EN: Case — anonymize.
  // ES: Caso — anonimiza.
  it('anonymize / anonimiza', () => { const a = anonymize(user); expect(a.email).toContain('deleted'); expect(a.wallet).toBeNull(); });
});
