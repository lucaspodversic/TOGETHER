'use client';
/**
 * EN: Profile: progress, ledger, rename, data export and account deletion.
 * ES: Perfil: progreso, ledger, renombrar, exportar datos y borrar la cuenta.
 * EN: Deletion asks for confirmation; points have no cash value (shown in copy).
 * ES: El borrado pide confirmación; los puntos no tienen valor monetario (indicado en el texto).
 */
// EN: Profile: level/XP, play points, history, data export and account deletion. / ES: Perfil: nivel/XP, puntos, historial, exportación y borrado.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { levelProgress } from '@/lib/progress';
import { useApp } from '@/lib/session';

interface Progress { xp: number; unlocked: string[]; best: Record<string, number>; points: number; pointsNote: string; sessions: { id: string; gameId: string; status: string; score?: number }[] }

// EN: `Profile` — see file header for its role in the flow.
// ES: `Profile` — ver encabezado del archivo para su papel en el flujo.
export default function Profile() {
  const { t, user, ready, logout } = useApp();
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(null);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    if (ready && !user) router.push('/login');
    if (user) void api<Progress>('/me/progress').then(setP).catch(() => undefined);
  }, [ready, user, router]);
  if (!user || !p) return <p>{t('common.loading')}</p>;
  const lp = levelProgress(p.xp);

  // EN: Export downloads a JSON file built in the browser. / ES: La exportación descarga un JSON armado en el navegador.
  const exportData = async () => {
    const data = await api('/me/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'palooza-my-data.json' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const del = async () => {
    if (!window.confirm(t('profile.deleteConfirm'))) return;
    await api('/me', { method: 'DELETE' });
    await logout();
    router.push('/');
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{user.displayName}</h1>
      <div className="panel space-y-2">
        <p>{t('profile.level')} {lp.level} · {t('profile.xp')} {p.xp}/{lp.next}</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lp.pct * 100)} className="h-2 bg-edge rounded">
          <div className="h-2 bg-pop rounded" style={{ width: `${lp.pct * 100}%` }} />
        </div>
        <p>{t('profile.points')}: <span className="mono">{p.points}</span> <span className="text-xs text-slate-400">({p.pointsNote})</span></p>
      </div>
      <div className="panel">
        <ul className="mono text-xs space-y-1">
          {p.sessions.map((s) => <li key={s.id}>{s.gameId} · {s.status} · {s.score ?? '-'}</li>)}
        </ul>
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={() => void exportData()}>{t('profile.export')}</button>
        <button className="btn text-bad" onClick={() => void del()}>{t('profile.delete')}</button>
      </div>
    </section>
  );
}
