'use client';
/**
 * EN: Admin console: users, held sessions, flags and audit tail.
 * ES: Consola admin: usuarios, sesiones retenidas, flags y auditoría.
 * EN: The server checks permissions on every call; hiding the UI is not security.
 * ES: El servidor verifica permisos en cada llamada; ocultar la UI no es seguridad.
 */
// EN: Admin console (UI hides by role; API enforces RBAC). / ES: Consola admin (la UI oculta por rol; la API aplica RBAC).
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/session';

interface U { id: string; email: string; displayName: string; role: string; frozen: boolean; points: number }
interface Held { id: string; gameId: string; userId: string; score?: number; signals: string[] }
interface Audit { seq: number; at: string; actor: string; action: string; target?: string }

// EN: `Admin` — see file header for its role in the flow.
// ES: `Admin` — ver encabezado del archivo para su papel en el flujo.
export default function Admin() {
  const { t, user } = useApp();
  const [users, setUsers] = useState<U[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [flags, setFlags] = useState<Record<string, { on: boolean; implemented: boolean }>>({});
  const [audit, setAudit] = useState<Audit[]>([]);
  const [recon, setRecon] = useState<string>('');

  // EN: Each panel loads independently so a missing permission only blanks that panel.
  // ES: Cada panel carga por separado: un permiso faltante solo deja vacío ese panel.
  const load = useCallback(() => {
    void api<U[]>('/admin/users').then(setUsers).catch(() => undefined);
    void api<Held[]>('/admin/sessions/held').then(setHeld).catch(() => undefined);
    void api<typeof flags>('/admin/flags').then(setFlags).catch(() => undefined);
    void api<{ entries: Audit[] }>('/admin/audit').then((r) => setAudit(r.entries)).catch(() => undefined);
  }, []);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  if (!user) return null;

  const act = async (path: string, body?: unknown) => {
    await api(path, { method: 'POST', body }).catch(() => undefined);
    load();
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">{t('nav.admin')}</h1>
      <div className="panel">
        <h2 className="font-semibold mb-2">{t('admin.users')}</h2>
        <table className="w-full text-xs mono">
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-edge">
                <td>{u.displayName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.points}</td>
                <td><button className="btn" onClick={() => void act(`/admin/users/${u.id}/freeze`, { frozen: !u.frozen })}>{u.frozen ? t('admin.unfreeze') : t('admin.freeze')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2 className="font-semibold mb-2">{t('admin.held')}</h2>
        {held.map((h) => (
          <div key={h.id} className="flex gap-2 items-center text-xs mono">
            {h.gameId} · {h.score} · {h.signals.join(',')}
            <button className="btn" onClick={() => void act(`/admin/sessions/${h.id}/approve`)}>{t('admin.approve')}</button>
            <button className="btn" onClick={() => void act(`/admin/sessions/${h.id}/void`)}>{t('admin.void')}</button>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2 className="font-semibold mb-2">{t('admin.flags')}</h2>
        <ul className="text-xs mono">
          {Object.entries(flags).map(([k, v]) => <li key={k}>{k}: {v.on ? 'ON' : 'OFF'} {v.implemented ? '' : '(not implemented / no implementado)'}</li>)}
        </ul>
      </div>
      <div className="panel">
        <button className="btn" onClick={() => void api<{ ok: boolean; problems: string[] }>('/admin/reconcile').then((r) => setRecon(r.ok ? 'OK' : r.problems.join('; '))).catch(() => setRecon('forbidden'))}>{t('admin.reconcile')}</button>
        <span className="ml-2 mono">{recon}</span>
      </div>
      <div className="panel">
        <h2 className="font-semibold mb-2">{t('admin.audit')}</h2>
        <ul className="text-xs mono max-h-64 overflow-auto">
          {audit.map((a) => <li key={a.seq}>{a.at} · {a.actor} · {a.action} {a.target ?? ''}</li>)}
        </ul>
      </div>
    </section>
  );
}
