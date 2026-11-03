/**
 * EN: Feature flags. Every real-value / regulated capability is listed here and DEFAULTS TO OFF.
 *     Turning one on in config is NOT enough to enable real money: those code paths are not
 *     implemented in this reference build and throw `GatedFeatureError` pending legal review.
 * ES: Feature flags. Toda capacidad de valor real / regulada figura acá y VIENE APAGADA.
 *     Encenderla en la config NO alcanza para habilitar dinero real: esos caminos no están
 *     implementados en esta versión de referencia y lanzan `GatedFeatureError` hasta la revisión legal.
 */
export const GATED_FEATURES = ['casino_games', 'betting', 'token_rewards', 'payouts', 'marketplace', 'nft_mint'] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];

export class GatedFeatureError extends Error {
  constructor(public readonly feature: string) {
    super(`feature_gated:${feature}`);
    this.name = 'GatedFeatureError';
  }
}

export class FeatureFlags {
  private readonly state = new Map<string, boolean>();
  // EN: Features that are flaggable but whose real-value implementation does not exist here.
  // ES: Funciones que admiten flag pero cuya implementación de valor real no existe acá.
  static readonly NOT_IMPLEMENTED: readonly GatedFeature[] = ['casino_games', 'betting', 'token_rewards', 'payouts', 'marketplace'];

  constructor(initial: Partial<Record<GatedFeature, boolean>> = {}) {
    for (const f of GATED_FEATURES) this.state.set(f, initial[f] === true);
  }

  /** EN: Read from env FEATURE_<NAME>=true (anything else = off). / ES: Lee del env FEATURE_<NOMBRE>=true. */
  static fromEnv(env: Record<string, string | undefined> = process.env): FeatureFlags {
    const init: Partial<Record<GatedFeature, boolean>> = {};
    for (const f of GATED_FEATURES) init[f] = env[`FEATURE_${f.toUpperCase()}`] === 'true';
    return new FeatureFlags(init);
  }

  isOn(f: GatedFeature): boolean {
    return this.state.get(f) === true;
  }

  set(f: GatedFeature, on: boolean): void {
    if (!GATED_FEATURES.includes(f)) throw new Error('unknown_flag');
    this.state.set(f, on);
  }

  /**
   * EN: Guard used at every gated entry point. Throws if off OR if not implemented (even if on).
   * ES: Guarda usada en cada punto de entrada con compuerta. Lanza si está apagada O si no está implementada.
   */
  require(f: GatedFeature): void {
    if (!this.isOn(f) || FeatureFlags.NOT_IMPLEMENTED.includes(f)) throw new GatedFeatureError(f);
  }

  snapshot(): Record<string, { on: boolean; implemented: boolean }> {
    return Object.fromEntries(GATED_FEATURES.map((f) => [f, { on: this.isOn(f), implemented: !FeatureFlags.NOT_IMPLEMENTED.includes(f) }]));
  }
}
