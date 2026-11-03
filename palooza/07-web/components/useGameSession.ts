'use client';
/**
 * EN: Hook: start a session, keep its seed, submit input and expose the result.
 * ES: Hook: inicia sesión, guarda su semilla, envía el input y expone el resultado.
 * EN: Errors are surfaced as API codes for i18n translation.
 * ES: Los errores se exponen como códigos de API para traducirlos.
 */
/**
 * EN: Hook wrapping the server game session: start (gets the seed) and submit (raw input).
 *     Guests can play locally with a random seed; only logged-in runs are recorded.
 * ES: Hook que envuelve la sesión de juego del servidor: start (obtiene la semilla) y submit (input crudo).
 *     Los invitados juegan localmente con semilla aleatoria; solo se registran partidas con sesión.
 */
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/session';

export interface SubmitResult { status: string; score: number; reason?: string; points: number }

// EN: `useGameSession` — see file header for its role in the flow.
// ES: `useGameSession` — ver encabezado del archivo para su papel en el flujo.
export function useGameSession(gameId: string) {
  const { user, err } = useApp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (): Promise<string> => {
    setResult(null);
    setError(null);
    if (!user) {
      setSessionId(null);
      return Math.random().toString(36).slice(2);
    }
    try {
      const s = await api<{ sessionId: string; seed: string }>(`/games/${gameId}/sessions`, { method: 'POST' });
      setSessionId(s.sessionId);
      return s.seed;
    } catch (e) {
      setError(err(e instanceof ApiError ? e.code : 'error'));
      return Math.random().toString(36).slice(2);
    }
  };

  const submit = async (input: unknown) => {
    if (!sessionId) return;
    try {
      setResult(await api<SubmitResult>(`/sessions/${sessionId}/submit`, { method: 'POST', body: { input } }));
    } catch (e) {
      setError(err(e instanceof ApiError ? e.code : 'error'));
    }
    setSessionId(null);
  };

  return { start, submit, result, error, recorded: Boolean(user) };
}
