// EN: Rewards engine tests. / ES: Tests del motor de recompensas.
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, FeatureFlags, GatedFeatureError, PointsLedger, matchRules, validateRules, type RewardEvent } from '../src/index.js';

const T = Date.UTC(2026, 10, 2, 12);
const ev = (o: Partial<RewardEvent>): RewardEvent => ({ type: 'session_accepted', userId: 'u1', ref: 's1', gameId: 'memory', score: 500, at: T, ...o });

// EN: Suite: rules.
// ES: Suite: reglas.
describe('rules / reglas', () => {
  // EN: Case — defaults valid.
  // ES: Caso — por defecto válidas.
  it('defaults valid / por defecto válidas', () => expect(validateRules(DEFAULT_RULES)).toEqual([]));
  // EN: Case — detects problems.
  // ES: Caso — detecta problemas.
  it('detects problems / detecta problemas', () => expect(validateRules([...DEFAULT_RULES, { ...DEFAULT_RULES[0]!, points: -1 }])).toEqual(['duplicate:play', 'points:play']));
  // EN: Case — matches by game+score.
  // ES: Caso — coincide por juego+puntaje.
  it('matches by game+score / coincide por juego+puntaje', () => {
    expect(matchRules(ev({ score: 950 }), DEFAULT_RULES).map((r) => r.id)).toEqual(['play', 'memory_high']);
    expect(matchRules(ev({ gameId: 'reaction', score: 950 }), DEFAULT_RULES).map((r) => r.id)).toEqual(['play', 'reaction_high']);
  });
  // EN: Case — inactive ignored.
  // ES: Caso — inactiva ignorada.
  it('inactive ignored / inactiva ignorada', () => expect(matchRules(ev({}), [{ ...DEFAULT_RULES[0]!, active: false }])).toEqual([]));
});

// EN: Suite: ledger.
// ES: Suite: libro.
describe('ledger / libro', () => {
  // EN: Case — grants and is idempotent.
  // ES: Caso — otorga y es idempotente.
  it('grants and is idempotent / otorga y es idempotente', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    expect(l.process(ev({ score: 950 }))).toHaveLength(2);
    expect(l.process(ev({ score: 950 }))).toHaveLength(0);
    expect(l.balance('u1')).toBe(25);
  });
  // EN: Case — daily cap.
  // ES: Caso — tope diario.
  it('daily cap / tope diario', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    for (let i = 0; i < 30; i++) l.process(ev({ ref: `s${i}` }));
    expect(l.balance('u1')).toBe(100);
    l.process(ev({ ref: 'next-day', at: T + 86_400_000 }));
    expect(l.balance('u1')).toBe(105);
  });
  // EN: Case — partial grant at cap edge.
  // ES: Caso — otorgamiento parcial en el borde.
  it('partial grant at cap edge / otorgamiento parcial en el borde', () => {
    const l = new PointsLedger([{ ...DEFAULT_RULES[0]!, points: 30, dailyCap: 50 }]);
    l.process(ev({ ref: 'a' }));
    expect(l.process(ev({ ref: 'b' }))[0]!.delta).toBe(20);
  });
  // EN: Case — records chain.
  // ES: Caso — registros encadenados.
  it('records chain / registros encadenados', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    l.process(ev({ ref: 'a' }));
    l.process(ev({ ref: 'b' }));
    const h = l.history();
    expect(h[1]!.prevHash).toBe(h[0]!.hash);
    expect(Object.isFrozen(h[0])).toBe(true);
  });
  // EN: Case — reconcile clean.
  // ES: Caso — conciliación limpia.
  it('reconcile clean / conciliación limpia', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    l.process(ev({ ref: 'a', score: 999 }));
    l.process(ev({ type: 'achievement_unlocked', ref: 'first_game', userId: 'u2' }));
    expect(l.reconcile()).toMatchObject({ ok: true, totals: { u1: 25, u2: 50 } });
  });
  // EN: Case — detects tampering.
  // ES: Caso — detecta manipulación.
  it('detects tampering / detecta manipulación', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    l.process(ev({ ref: 'a' }));
    l.process(ev({ ref: 'b' }));
    const forged = l.history().map((r) => ({ ...r }));
    forged[0]!.delta = 999;
    expect(l.reconcile(forged).problems).toContain('hash_mismatch@0');
    expect(l.reconcile(forged.slice(1)).problems).toEqual(expect.arrayContaining(['seq_gap@0', 'chain_break@0']));
  });
  // EN: Case — detects balance cache drift.
  // ES: Caso — detecta desvío de caché.
  it('detects balance cache drift / detecta desvío de caché', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    l.process(ev({ ref: 'a' }));
    l._corruptBalance('u1', 1);
    expect(l.reconcile().problems).toEqual(['balance_mismatch:u1']);
  });
  // EN: Case — adjustments need reason, no negative.
  // ES: Caso — ajustes requieren motivo, sin negativos.
  it('adjustments need reason, no negative / ajustes requieren motivo, sin negativos', () => {
    const l = new PointsLedger(DEFAULT_RULES);
    l.process(ev({ ref: 'a' }));
    expect(() => l.adjust('u1', -1, 'admin', '')).toThrow('reason_required');
    expect(() => l.adjust('u1', -100, 'admin', 'abuse correction')).toThrow('negative_balance');
    expect(l.adjust('u1', -5, 'admin', 'abuse correction').kind).toBe('adjustment');
    expect(l.balance('u1')).toBe(0);
    expect(l.reconcile().ok).toBe(true);
  });
});

// EN: Suite: flags.
// ES: Suite: compuertas.
describe('flags / compuertas', () => {
  // EN: Case — all off by default.
  // ES: Caso — todo apagado por defecto.
  it('all off by default / todo apagado por defecto', () => expect(Object.values(new FeatureFlags().snapshot()).every((f) => !f.on)).toBe(true));
  // EN: Case — fromEnv only exact true.
  // ES: Caso — fromEnv solo "true" exacto.
  it('fromEnv only exact true / fromEnv solo "true" exacto', () => {
    const f = FeatureFlags.fromEnv({ FEATURE_NFT_MINT: 'true', FEATURE_BETTING: '1' });
    expect(f.isOn('nft_mint')).toBe(true);
    expect(f.isOn('betting')).toBe(false);
  });
  // EN: Case — redeem gated.
  // ES: Caso — canje con compuerta.
  it('redeem gated / canje con compuerta', () => expect(() => new PointsLedger(DEFAULT_RULES).redeemForValue('u1', 10)).toThrow(GatedFeatureError));
  // EN: Case — even when on, unimplemented stays gated.
  // ES: Caso — aun encendida, sigue con compuerta.
  it('even when on, unimplemented stays gated / aun encendida, sigue con compuerta', () => {
    const f = new FeatureFlags({ token_rewards: true, betting: true });
    expect(() => f.require('token_rewards')).toThrow(GatedFeatureError);
    expect(() => f.require('betting')).toThrow(GatedFeatureError);
  });
  // EN: Case — nft_mint requires on.
  // ES: Caso — nft_mint requiere encendido.
  it('nft_mint requires on / nft_mint requiere encendido', () => {
    expect(() => new FeatureFlags().require('nft_mint')).toThrow();
    expect(() => new FeatureFlags({ nft_mint: true }).require('nft_mint')).not.toThrow();
  });
  // EN: Case — unknown flag rejected.
  // ES: Caso — flag desconocida rechazada.
  it('unknown flag rejected / flag desconocida rechazada', () => expect(() => new FeatureFlags().set('x' as never, true)).toThrow());
});
