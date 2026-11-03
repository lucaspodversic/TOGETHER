'use client';
/**
 * EN: Memory match: the deck comes from the server seed so both sides agree.
 * ES: Memoria: el mazo sale de la semilla del servidor para que ambos lados coincidan.
 * EN: Flips are sent as indices; the server re-derives pairs and score.
 * ES: Los giros se envían como índices; el servidor recalcula pares y puntaje.
 */
// EN: Memory Match client. The server replays `flips` with the same seed. / ES: Cliente de Memotest; el servidor reproduce `flips` con la misma semilla.
import { useEffect, useState } from 'react';
import { memoryBoard } from '@palooza/game-services/browser';
import { memoryDone, memoryFlip, memoryHide, memoryInit, type MemoryState } from '@/lib/progress';
import { useGameSession } from '@/components/useGameSession';
import { ResultBanner } from '@/components/ResultBanner';
import { useApp } from '@/lib/session';

const ICONS = ['🍒', '🚀', '🎈', '🐙', '🌵', '🎲', '⚡', '🍩'];

// EN: `MemoryPage` — see file header for its role in the flow.
// ES: `MemoryPage` — ver encabezado del archivo para su papel en el flujo.
export default function MemoryPage() {
  const { t } = useApp();
  const g = useGameSession('memory');
  const [s, setS] = useState<MemoryState | null>(null);
  const [sent, setSent] = useState(false);

  const begin = async () => {
    setSent(false);
    setS(memoryInit(memoryBoard(await g.start())));
  };
  // EN: Auto-hide a wrong pair after 700 ms. / ES: Oculta un par incorrecto a los 700 ms.
  useEffect(() => {
    if (s && s.open.length === 2) {
      const id = setTimeout(() => setS(memoryHide(s)), 700);
      return () => clearTimeout(id);
    }
  }, [s]);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    if (s && memoryDone(s) && !sent) {
      setSent(true);
      void g.submit({ flips: s.flips });
    }
  }, [s, sent, g]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Memory Match / Memotest</h1>
      <button className="btn-primary" onClick={() => void begin()}>{t('game.start')}</button>
      {s && (
        <>
          <p>{t('memory.attempts')}: <span className="mono">{s.attempts}</span></p>
          <div className="grid grid-cols-4 gap-2 max-w-xs" role="grid">
            {s.board.map((v, i) => {
              const shown = s.open.includes(i) || s.matched.includes(i);
              return (
                <button key={i} className={`h-16 rounded-lg text-2xl ${shown ? 'bg-zap/30' : 'bg-edge'}`} aria-label={shown ? `card ${i + 1}: ${ICONS[v]}` : `card ${i + 1}, hidden`} onClick={() => setS(memoryFlip(s, i))}>
                  {shown ? ICONS[v] : '?'}
                </button>
              );
            })}
          </div>
        </>
      )}
      <ResultBanner result={g.result} error={g.error} recorded={g.recorded} />
    </section>
  );
}
