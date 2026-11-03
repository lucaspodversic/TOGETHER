'use client';
/**
 * EN: 2048 (merge2048): keyboard/swipe input recorded as moves and replayed server-side.
 * ES: 2048 (merge2048): input de teclado/deslizamiento grabado como movimientos y reproducido en el servidor.
 * EN: The local board is a preview; the official score is whatever the server replay computes.
 * ES: El tablero local es una vista previa; el puntaje oficial es el que calcula la reproducción del servidor.
 */
// EN: 2048 client. Every move is appended to a "UDLR" string the server replays. / ES: Cliente 2048; cada movimiento se agrega a un string "UDLR" que el servidor reproduce.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply2048, canMove, new2048, type Move, type State2048 } from '@palooza/game-services/browser';
import { KEY_TO_MOVE } from '@/lib/progress';
import { useGameSession } from '@/components/useGameSession';
import { ResultBanner } from '@/components/ResultBanner';
import { useApp } from '@/lib/session';

// EN: `Page2048` — see file header for its role in the flow.
// ES: `Page2048` — ver encabezado del archivo para su papel en el flujo.
export default function Page2048() {
  const { t } = useApp();
  const g = useGameSession('merge2048');
  const st = useRef<State2048 | null>(null);
  const moves = useRef('');
  const [, force] = useState(0);
  const [over, setOver] = useState(false);

  const begin = async () => {
    st.current = new2048(await g.start());
    moves.current = '';
    setOver(false);
    force((n) => n + 1);
  };
  const move = useCallback((m: Move) => {
    const s = st.current;
    if (!s || over) return;
    if (apply2048(s, m)) moves.current += m;
    if (!canMove(s.board)) {
      setOver(true);
      void g.submit({ moves: moves.current });
    }
    force((n) => n + 1);
  }, [over, g]);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const m = KEY_TO_MOVE[e.key];
      if (m) {
        e.preventDefault();
        move(m);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [move]);

  const s = st.current;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">2048</h1>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => void begin()}>{t('game.start')}</button>
        {s && !over && <button className="btn" onClick={() => { setOver(true); void g.submit({ moves: moves.current }); }}>{t('game.submit')}</button>}
      </div>
      <p className="text-xs text-slate-400">{t('g2048.keys')}</p>
      {s && (
        <>
          <p className="mono">Score: {s.score}</p>
          <div className="grid grid-cols-4 gap-2 w-72" aria-label="board">
            {s.board.map((v, i) => (
              <div key={i} className={`h-16 rounded-lg flex items-center justify-center font-bold mono ${v ? 'bg-pop/30' : 'bg-edge'}`}>{v || ''}</div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 w-36">
            <span /><button className="btn" aria-label="up" onClick={() => move('U')}>↑</button><span />
            <button className="btn" aria-label="left" onClick={() => move('L')}>←</button>
            <button className="btn" aria-label="down" onClick={() => move('D')}>↓</button>
            <button className="btn" aria-label="right" onClick={() => move('R')}>→</button>
          </div>
        </>
      )}
      <ResultBanner result={g.result} error={g.error} recorded={g.recorded} />
    </section>
  );
}
