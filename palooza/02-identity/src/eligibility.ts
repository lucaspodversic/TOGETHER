/**
 * EN: Age and region eligibility. The rules are CONFIGURATION, not legal advice: the real
 *     blocked-region list and minimum ages must come from the legal/compliance review.
 *     Gated features (casino-style etc.) require stricter checks and stay off by default.
 * ES: Elegibilidad por edad y región. Las reglas son CONFIGURACIÓN, no asesoría legal: la lista
 *     real de regiones bloqueadas y edades mínimas debe salir de la revisión legal/compliance.
 *     Las funciones con compuerta (estilo casino, etc.) requieren chequeos más estrictos y vienen apagadas.
 */
export interface EligibilityPolicy {
  minAge: number; // EN: minimum age for the base platform / ES: edad mínima de la plataforma base
  blockedRegions: string[]; // EN: ISO-3166 codes / ES: códigos ISO-3166
  // EN: Per-feature overrides (e.g. a future gated feature needing 18/21+).
  // ES: Ajustes por función (p. ej. una futura función con compuerta que exija 18/21+).
  featureMinAge?: Record<string, number>;
  featureAllowedRegions?: Record<string, string[]>;
}

// EN: Placeholder defaults — TBD by legal. 13 = typical general-audience floor (COPPA).
// ES: Valores por defecto provisorios — a definir por legal. 13 = piso típico de audiencia general (COPPA).
export const DEFAULT_POLICY: EligibilityPolicy = {
  minAge: 13,
  blockedRegions: [],
  featureMinAge: { casino: 21, betting: 21, token_rewards: 18, marketplace: 18 },
  // EN: Empty allow-list ⇒ gated feature is unavailable everywhere until legal fills it in.
  // ES: Lista permitida vacía ⇒ la función con compuerta no está disponible en ningún lado hasta que legal la complete.
  featureAllowedRegions: { casino: [], betting: [], token_rewards: [], marketplace: [] },
};

/** EN: Full years between birthdate and now (UTC). / ES: Años cumplidos entre nacimiento y ahora (UTC). */
export function ageOn(birthDate: string, now = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return -1;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  // EN: Birthday not reached yet this year → subtract one. / ES: Si aún no cumplió este año → restar uno.
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export type EligibilityResult = { ok: true } | { ok: false; reason: 'invalid_birthdate' | 'underage' | 'region_blocked' | 'feature_region_unavailable' };

/**
 * EN: Check base-platform (feature undefined) or a specific feature's eligibility.
 * ES: Verifica elegibilidad de la plataforma base (feature indefinida) o de una función concreta.
 */
export function checkEligibility(input: { birthDate: string; region: string; feature?: string }, policy = DEFAULT_POLICY, now = new Date()): EligibilityResult {
  const age = ageOn(input.birthDate, now);
  if (age < 0 || age > 130) return { ok: false, reason: 'invalid_birthdate' };
  const region = input.region.toUpperCase();
  if (policy.blockedRegions.includes(region)) return { ok: false, reason: 'region_blocked' };
  const minAge = input.feature ? (policy.featureMinAge?.[input.feature] ?? policy.minAge) : policy.minAge;
  if (age < minAge) return { ok: false, reason: 'underage' };
  if (input.feature && policy.featureAllowedRegions?.[input.feature]) {
    // EN: Explicit allow-list for gated features. / ES: Lista permitida explícita para funciones con compuerta.
    if (!policy.featureAllowedRegions[input.feature]!.includes(region)) return { ok: false, reason: 'feature_region_unavailable' };
  }
  return { ok: true };
}
