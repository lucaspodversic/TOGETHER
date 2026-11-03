// EN: Tests for pure web helpers (i18n, progression, memory client). / ES: Tests de helpers web puros (i18n, progresión, memotest).
import { describe, expect, it } from 'vitest';
import { memoryBoard, memoryGame } from '@palooza/game-services/browser';
import { DICT, detectLocale, errorText, translate } from '../lib/i18n';
import { KEY_TO_MOVE, levelProgress, memoryDone, memoryFlip, memoryHide, memoryInit, xpForLevel } from '../lib/progress';

// EN: Suite: i18n.
// ES: Suite: i18n.
describe('i18n', () => {
  // EN: Case — en and es have the same keys.
  // ES: Caso — en y es tienen las mismas claves.
  it('en and es have the same keys / en y es tienen las mismas claves', () => {
    expect(Object.keys(DICT.es).sort()).toEqual(Object.keys(DICT.en).sort());
  });
  // EN: Case — no empty strings.
  // ES: Caso — sin textos vacíos.
  it('no empty strings / sin textos vacíos', () => {
    for (const l of ['en', 'es'] as const) expect(Object.values(DICT[l]).every((v) => v.trim().length > 0)).toBe(true);
  });
  // EN: Case — translates and falls back.
  // ES: Caso — traduce y cae a respaldo.
  it('translates and falls back / traduce y cae a respaldo', () => {
    expect(translate('es', 'nav.games')).toBe('Juegos');
    expect(translate('es', 'missing.key')).toBe('missing.key');
  });
  // EN: Case — detects locale.
  // ES: Caso — detecta idioma.
  it('detects locale / detecta idioma', () => {
    expect(detectLocale('es-AR')).toBe('es');
    expect(detectLocale('fr')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
  // EN: Case — maps error codes.
  // ES: Caso — mapea códigos de error.
  it('maps error codes / mapea códigos de error', () => {
    expect(errorText('es', 'invalid_credentials')).toContain('incorrectos');
    expect(errorText('en', 'weird')).toBe('Something went wrong');
  });
});

// EN: Suite: progression helpers.
// ES: Suite: helpers de progresión.
describe('progression helpers / helpers de progresión', () => {
  // EN: Case — level math matches engine.
  // ES: Caso — cálculo de nivel coincide con el motor.
  it('level math matches engine / cálculo de nivel coincide con el motor', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelProgress(0)).toMatchObject({ level: 1, pct: 0, next: 100 });
    expect(levelProgress(250).level).toBe(2);
    expect(levelProgress(250).pct).toBeCloseTo(0.5);
  });
  // EN: Case — keyboard map.
  // ES: Caso — mapa de teclado.
  it('keyboard map / mapa de teclado', () => expect(KEY_TO_MOVE.ArrowLeft).toBe('L'));
});

// EN: Suite: memory client.
// ES: Suite: cliente memotest.
describe('memory client / cliente memotest', () => {
  // EN: Case — recorded flips replay to a perfect server score.
  // ES: Caso — los flips grabados dan puntaje perfecto en el servidor.
  it('recorded flips replay to a perfect server score / los flips grabados dan puntaje perfecto en el servidor', () => {
    const board = memoryBoard('abc');
    let s = memoryInit(board);
    for (let v = 0; v < 8; v++) for (const i of board.flatMap((x, j) => (x === v ? [j] : []))) s = memoryFlip(s, i);
    expect(memoryDone(s)).toBe(true);
    expect(memoryGame.replay('abc', { flips: s.flips })).toMatchObject({ valid: true, score: 1000 });
  });
  // EN: Case — ignores invalid clicks and hides misses.
  // ES: Caso — ignora clics inválidos y oculta fallos.
  it('ignores invalid clicks and hides misses / ignora clics inválidos y oculta fallos', () => {
    const board = memoryBoard('abc');
    const a = 0;
    const b = board.findIndex((v, i) => i !== a && v !== board[a]);
    let s = memoryFlip(memoryInit(board), a);
    expect(memoryFlip(s, a)).toBe(s);
    s = memoryFlip(s, b);
    expect(s.open).toHaveLength(2);
    expect(memoryFlip(s, 5)).toBe(s);
    s = memoryHide(s);
    expect(s.open).toHaveLength(0);
    expect(memoryGame.replay('abc', { flips: s.flips }).valid).toBe(true);
  });
});
