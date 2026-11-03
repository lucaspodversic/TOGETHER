/**
 * EN: Contract every game implements. The server only trusts `replay(seed, input)`: the client
 *     sends its raw moves, never a score.
 * ES: Contrato que implementa cada juego. El servidor solo confía en `replay(semilla, input)`: el
 *     cliente envía sus jugadas crudas, nunca un puntaje.
 */
export interface ReplayResult {
  valid: boolean; // EN: input was legal / ES: el input fue legal
  score: number; // EN: authoritative score / ES: puntaje autoritativo
  completed: boolean; // EN: game reached its end state / ES: el juego llegó a su fin
  reason?: string; // EN: why invalid / ES: por qué es inválido
  stats?: Record<string, number>;
}

export interface GameDefinition<I = unknown> {
  id: string;
  name: { en: string; es: string };
  kind: 'casual' | 'skill' | 'casino';
  // EN: Upper bound used by anti-abuse (anything above is impossible). / ES: Cota superior para anti-abuso.
  maxScore: number;
  // EN: Minimum plausible duration of a completed run, ms. / ES: Duración mínima plausible de una partida completa, ms.
  minDurationMs: number;
  // EN: Max moves accepted (payload size guard). / ES: Máximo de jugadas aceptadas (guarda de tamaño).
  maxInputs: number;
  replay(seed: string, input: I): ReplayResult;
}
