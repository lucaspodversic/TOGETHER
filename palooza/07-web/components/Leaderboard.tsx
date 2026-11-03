'use client';
/**
 * EN: Live leaderboard over WebSocket with polite aria-live updates.
 * ES: Ranking en vivo por WebSocket con actualizaciones aria-live educadas.
 * EN: Socket closes on unmount to avoid leaks.
 * ES: El socket se cierra al desmontar para evitar fugas.
 */
/**
 * EN: Leaderboard table with live updates over WebSocket (falls back to a REST snapshot).
 * ES: Tabla de ranking con actualizaciones en vivo por WebSocket (con respaldo REST).
 */
import { useEffect, useState } from 'react';
import { api, WS_URL } from '@/lib/api';
import { useApp } from '@/lib/session';

interface Entry { rank: number; score: number; player: string }

// EN: `Leaderboard` — see file header for its role in the flow.
// ES: `Leaderboard` — ver encabezado del archivo para su papel en el flujo.
export function Leaderboard({ gameId }: { gameId: string }) {
  const { t } = useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [live, setLive] = useState(false);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    void api<{ entries: Entry[] }>(`/leaderboards/${gameId}`).then((r) => setEntries(r.entries)).catch(() => undefined);
    const ws = new WebSocket(`${WS_URL}/v1/ws/leaderboard?gameId=${encodeURIComponent(gameId)}`);
    ws.onopen = () => setLive(true);
    ws.onclose = () => setLive(false);
    ws.onmessage = (m) => {
      const d = JSON.parse(String(m.data)) as { type: string; entries: Entry[] };
      if (d.type === 'leaderboard') setEntries(d.entries);
    };
    return () => ws.close();
  }, [gameId]);
  return (
    <div>
      {live && <span className="text-xs text-good" aria-live="polite">● {t('lb.live')}</span>}
      {entries.length === 0 ? (
        <p className="text-slate-400">{t('lb.empty')}</p>
      ) : (
        <table className="w-full mono">
          <caption className="sr-only">{gameId}</caption>
          <thead><tr className="text-left text-slate-400"><th scope="col">{t('lb.rank')}</th><th scope="col">{t('lb.player')}</th><th scope="col">{t('lb.score')}</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.rank} className="border-t border-edge"><td>#{e.rank}</td><td>{e.player}</td><td>{e.score}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
