// EN: Analytics schema, quality and funnel tests. / ES: Tests de esquema, calidad y embudo.
import { describe, expect, it } from 'vitest';
import { checkQuality, completionByGame, d1Retention, funnel, renderReport, syntheticEvents, validateEvent, type AnalyticsEvent } from '../src/index.js';

const e = (o: Partial<AnalyticsEvent>): AnalyticsEvent => ({ v: 1, eventId: Math.random().toString(36), name: 'signup_started', anonId: 'abcdef12', ts: '2026-11-01T10:00:00Z', props: {}, ...o });

// EN: Suite: schema.
// ES: Suite: esquema.
describe('schema / esquema', () => {
  // EN: Case — valid event.
  // ES: Caso — evento válido.
  it('valid event / evento válido', () => expect(validateEvent(e({}))).toEqual([]));
  // EN: Case — unknown event.
  // ES: Caso — evento desconocido.
  it('unknown event / evento desconocido', () => expect(validateEvent(e({ name: 'hack' as never }))).toContain('unknown_event'));
  // EN: Case — missing props.
  // ES: Caso — props faltantes.
  it('missing props / props faltantes', () => expect(validateEvent(e({ name: 'game_started' }))).toContain('missing_prop:gameId'));
  // EN: Case — blocks PII keys and values.
  // ES: Caso — bloquea PII.
  it('blocks PII keys and values / bloquea PII', () => {
    expect(validateEvent(e({ props: { email: 'x' } }))).toContain('pii_key:email');
    expect(validateEvent(e({ props: { note: 'lucas@example.com' } }))).toContain('pii_value:note');
    expect(validateEvent(e({ props: { ref: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } }))).toContain('pii_value:ref');
  });
  // EN: Case — bad anonId.
  // ES: Caso — anonId inválido.
  it('bad anonId / anonId inválido', () => expect(validateEvent(e({ anonId: 'User Name' }))).toContain('bad_anonId'));
});

// EN: Suite: quality.
// ES: Suite: calidad.
describe('quality / calidad', () => {
  // EN: Case — synthetic data passes.
  // ES: Caso — datos sintéticos pasan.
  it('synthetic data passes / datos sintéticos pasan', () => {
    const q = checkQuality(syntheticEvents(), Date.parse('2030-01-01'));
    expect(q.passed).toBe(true);
    expect(q.valid).toBe(q.total);
  });
  // EN: Case — detects duplicates, future, orphans.
  // ES: Caso — detecta duplicados, futuros, huérfanos.
  it('detects duplicates, future, orphans / detecta duplicados, futuros, huérfanos', () => {
    const q = checkQuality([
      e({ eventId: 'a' }), e({ eventId: 'a' }),
      e({ eventId: 'b', ts: '2099-01-01T00:00:00Z' }),
      e({ eventId: 'c', name: 'game_completed', props: { gameId: 'memory', score: 1, status: 'accepted' } }),
    ], Date.parse('2026-11-02'));
    expect(q).toMatchObject({ duplicates: 1, future: 1, orphanCompletions: 1, passed: false });
  });
  // EN: Case — empty batch fails.
  // ES: Caso — lote vacío falla.
  it('empty batch fails / lote vacío falla', () => expect(checkQuality([]).passed).toBe(false));
});

// EN: Suite: funnel.
// ES: Suite: embudo.
describe('funnel / embudo', () => {
  // EN: Case — ordered steps only.
  // ES: Caso — solo pasos en orden.
  it('ordered steps only / solo pasos en orden', () => {
    const evs = [
      e({ anonId: 'aaaaaaaa', name: 'signup_started', ts: '2026-11-01T10:00:00Z' }),
      e({ anonId: 'aaaaaaaa', name: 'signup_completed', ts: '2026-11-01T10:01:00Z' }),
      // EN: user b completes before starting → only step 0 counts for ordering. / ES: b completa antes de iniciar.
      e({ anonId: 'bbbbbbbb', name: 'signup_completed', ts: '2026-11-01T10:00:00Z' }),
      e({ anonId: 'bbbbbbbb', name: 'signup_started', ts: '2026-11-01T10:05:00Z' }),
    ];
    const f = funnel(evs);
    expect(f[0]!.users).toBe(2);
    expect(f[1]!.users).toBe(1);
    expect(f[1]!.conversionFromPrev).toBe(0.5);
  });
  // EN: Case — monotonic on synthetic.
  // ES: Caso — monótono en sintéticos.
  it('monotonic on synthetic / monótono en sintéticos', () => {
    const f = funnel(syntheticEvents());
    for (let i = 1; i < f.length; i++) expect(f[i]!.users).toBeLessThanOrEqual(f[i - 1]!.users);
  });
  // EN: Case — d1 retention.
  // ES: Caso — retención d1.
  it('d1 retention / retención d1', () => {
    expect(d1Retention([e({ anonId: 'aaaaaaaa', ts: '2026-11-01T10:00:00Z' }), e({ anonId: 'aaaaaaaa', ts: '2026-11-02T10:00:00Z' }), e({ anonId: 'bbbbbbbb' })])).toBe(0.5);
  });
  // EN: Case — completion by game.
  // ES: Caso — finalización por juego.
  it('completion by game / finalización por juego', () => {
    const c = completionByGame([e({ name: 'game_started', props: { gameId: 'memory' } }), e({ name: 'game_started', props: { gameId: 'memory' } }), e({ name: 'game_completed', props: { gameId: 'memory', score: 1, status: 'accepted' } })]);
    expect(c.memory).toEqual({ started: 2, accepted: 1, rate: 0.5 });
  });
  // EN: Case — report renders.
  // ES: Caso — reporte se genera.
  it('report renders / reporte se genera', () => expect(renderReport(syntheticEvents(50))).toContain('FUNNEL / EMBUDO'));
  // EN: Case — synthetic deterministic.
  // ES: Caso — sintéticos deterministas.
  it('synthetic deterministic / sintéticos deterministas', () => expect(syntheticEvents(10)).toEqual(syntheticEvents(10)));
});
