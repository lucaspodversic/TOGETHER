/**
 * EN: "Reaction Rush": 5 rounds; the stimulus delay per round comes from the seed. Input = the
 *     reaction time in ms the client measured per round. Human floor ≈ 100 ms, so anything faster
 *     is flagged as impossible (likely automation or a false start).
 *     Limitation: client-measured timings can be spoofed within the plausible range; the session
 *     wall-clock check in the session manager bounds this, and server-timed rounds over WebSocket
 *     are the documented hardening path.
 * ES: "Reaction Rush": 5 rondas; el retardo del estímulo sale de la semilla. Input = el tiempo de
 *     reacción en ms medido por el cliente en cada ronda. El piso humano ≈ 100 ms, así que algo más
 *     rápido se marca como imposible (probable automatización o salida en falso).
 *     Limitación: los tiempos medidos por el cliente pueden falsearse dentro del rango plausible; el
 *     chequeo de reloj de la sesión lo acota, y las rondas cronometradas por servidor vía WebSocket
 *     son el endurecimiento documentado.
 */
import { mulberry32, seedFrom } from '../rng.js';
import type { GameDefinition, ReplayResult } from './types.js';

export const REACTION_ROUNDS = 5;
export const HUMAN_FLOOR_MS = 100;
export const TIMEOUT_MS = 2000;

/** EN: Stimulus delays (1–3 s) per round. / ES: Retardos del estímulo (1–3 s) por ronda. */
export function reactionDelays(seed: string): number[] {
  const rnd = mulberry32(seedFrom(`reaction:${seed}`));
  return Array.from({ length: REACTION_ROUNDS }, () => 1000 + Math.floor(rnd() * 2000));
}

/** EN: Points per round: faster ⇒ more, max 200. / ES: Puntos por ronda: más rápido ⇒ más, máx 200. */
export const roundPoints = (ms: number) => (ms >= TIMEOUT_MS ? 0 : Math.round(200 * (1 - (ms - HUMAN_FLOOR_MS) / (TIMEOUT_MS - HUMAN_FLOOR_MS))));

export const reactionGame: GameDefinition<{ times: number[] }> = {
  id: 'reaction',
  name: { en: 'Reaction Rush', es: 'Reflejos al Toque' },
  kind: 'skill',
  maxScore: 200 * REACTION_ROUNDS,
  // EN: Sum of minimum delays (5 × 1 s). / ES: Suma de retardos mínimos (5 × 1 s).
  minDurationMs: 5000,
  maxInputs: REACTION_ROUNDS,
  replay(_seed, input): ReplayResult {
    const times = input?.times;
    if (!Array.isArray(times) || times.length !== REACTION_ROUNDS) return { valid: false, score: 0, completed: false, reason: 'need_5_rounds' };
    if (!times.every((t) => Number.isFinite(t) && t >= 0)) return { valid: false, score: 0, completed: false, reason: 'bad_time' };
    // EN: Sub-human reactions are rejected outright. / ES: Reacciones sub-humanas se rechazan.
    if (times.some((t) => t < HUMAN_FLOOR_MS)) return { valid: false, score: 0, completed: false, reason: 'impossible_reaction' };
    const score = times.reduce((acc, t) => acc + roundPoints(Math.min(t, TIMEOUT_MS)), 0);
    return { valid: true, completed: true, score, stats: { avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length), best: Math.min(...times) } };
  },
};
