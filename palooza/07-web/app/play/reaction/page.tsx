'use client';
/**
 * EN: Reaction test: measures response time after a randomized delay.
 * ES: Test de reacción: mide el tiempo de respuesta tras un retraso aleatorio.
 * EN: Known limitation: timing is client-measured; the server applies plausibility bounds.
 * ES: Limitación conocida: el tiempo se mide en el cliente; el servidor aplica límites de plausibilidad.
 */
/**
 * EN: Reaction Rush client. Delays come from the seed; reaction times are measured client-side
 *     (documented limitation) and validated server-side (human floor, timing, outliers).
 * ES: Cliente de Reflejos. Los retardos salen de la semilla; los tiempos se miden en el cliente
 *     (limitación documentada) y se validan en el servidor (piso humano, tiempos, outliers).
 */
import { useRef, useState } from 'react';
import { REACTION_ROUNDS, TIMEOUT_MS, reactionDelays } from '@palooza/game-services/browser';
import { useGameSession } from '@/components/useGameSession';
import { ResultBanner } from '@/components/ResultBanner';
import { useApp } from '@/lib/session';

type Phase = 'idle' | 'wait' | 'go' | 'done';

// EN: `ReactionPage` — see file header for its role in the flow.
// ES: `ReactionPage` — ver encabezado del archivo para su papel en el flujo.
export default function ReactionPage() {
  const { t } = useApp();
  const g = useGameSession('reaction');
  const [phase, setPhase] = useState<Phase>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const delays = useRef<number[]>([]);
  const shownAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const arm = (round: number) => {
    setPhase('wait');
    timer.current = setTimeout(() => {
      shownAt.current = performance.now();
      setPhase('go');
      // EN: Auto-timeout counts as TIMEOUT_MS. / ES: El timeout cuenta como TIMEOUT_MS.
      timer.current = setTimeout(() => record(TIMEOUT_MS, round), TIMEOUT_MS);
    }, delays.current[round]);
  };
  const record = (ms: number, round: number) => {
    clearTimeout(timer.current);
    setTimes((prev) => {
      const next = [...prev, Math.round(ms)];
      if (next.length >= REACTION_ROUNDS) {
        setPhase('done');
        void g.submit({ times: next });
      } else arm(round + 1);
      return next;
    });
  };
  const begin = async () => {
    setTimes([]);
    setNote('');
    delays.current = reactionDelays(await g.start());
    arm(0);
  };
  const tap = () => {
    if (phase === 'wait') {
      // EN: Early tap restarts the round (no penalty, no score). / ES: Tocar antes reinicia la ronda.
      clearTimeout(timer.current);
      setNote(t('reaction.early'));
      arm(times.length);
    } else if (phase === 'go') record(performance.now() - shownAt.current, times.length);
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Reaction Rush / Reflejos</h1>
      <button className="btn-primary" onClick={() => void begin()} disabled={phase === 'wait' || phase === 'go'}>{t('game.start')}</button>
      <button
        className={`w-full h-48 rounded-xl text-2xl font-bold ${phase === 'go' ? 'bg-good text-black' : 'bg-edge'}`}
        onPointerDown={tap}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && tap()}
        aria-live="assertive"
      >
        {phase === 'go' ? t('reaction.now') : phase === 'wait' ? t('reaction.wait') : '—'}
      </button>
      <p className="text-bad">{note}</p>
      <p className="mono">{times.map((x) => `${x}ms`).join(' · ')}</p>
      <ResultBanner result={g.result} error={g.error} recorded={g.recorded} />
    </section>
  );
}
