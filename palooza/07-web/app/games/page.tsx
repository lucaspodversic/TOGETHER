'use client';
/**
 * EN: Game catalogue fetched from GET /v1/games; maps game ids to play routes.
 * ES: Catálogo de juegos desde GET /v1/games; asocia ids de juego con rutas de juego.
 * EN: Only casual/skill games appear: no casino entries exist server-side.
 * ES: Solo aparecen juegos casuales/de habilidad: no existen entradas de casino en el servidor.
 */
// EN: Game catalogue (static list from the shared engine registry). / ES: Catálogo (lista del registro compartido de motores).
import Link from 'next/link';
import { catalogue } from '@palooza/game-services/browser';
import { useApp } from '@/lib/session';

const ROUTE: Record<string, string> = { memory: '/play/memory', reaction: '/play/reaction', merge2048: '/play/2048' };

// EN: `Games` — see file header for its role in the flow.
// ES: `Games` — ver encabezado del archivo para su papel en el flujo.
export default function Games() {
  const { t, locale } = useApp();
  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">{t('nav.games')}</h1>
      <ul className="grid sm:grid-cols-3 gap-4">
        {catalogue().map((g) => (
          <li key={g.id} className="panel space-y-2">
            <h2 className="text-lg font-semibold">{g.name[locale]}</h2>
            <p className="text-slate-400 text-xs">{t('games.max')}: {g.maxScore.toLocaleString()}</p>
            <Link className="btn-primary inline-block" href={ROUTE[g.id] ?? '/games'}>{t('games.play')}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
