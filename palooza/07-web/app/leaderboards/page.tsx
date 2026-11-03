'use client';
/**
 * EN: Leaderboards page: one live <Leaderboard> per game.
 * ES: Página de rankings: un <Leaderboard> en vivo por juego.
 * EN: Shows display names only; the API never sends emails or ids.
 * ES: Muestra solo nombres visibles; la API nunca envía emails ni ids.
 */
// EN: Leaderboards per game with live updates. / ES: Rankings por juego con actualizaciones en vivo.
import { useState } from 'react';
import { catalogue } from '@palooza/game-services/browser';
import { Leaderboard } from '@/components/Leaderboard';
import { useApp } from '@/lib/session';

// EN: `Leaderboards` — see file header for its role in the flow.
// ES: `Leaderboards` — ver encabezado del archivo para su papel en el flujo.
export default function Leaderboards() {
  const { t, locale } = useApp();
  const games = catalogue();
  const [gameId, setGameId] = useState(games[0]!.id);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.leaderboards')}</h1>
      <div role="tablist" className="flex gap-2">
        {games.map((g) => (
          <button key={g.id} role="tab" aria-selected={g.id === gameId} className={g.id === gameId ? 'btn-primary' : 'btn'} onClick={() => setGameId(g.id)}>{g.name[locale]}</button>
        ))}
      </div>
      <div className="panel"><Leaderboard gameId={gameId} /></div>
    </section>
  );
}
