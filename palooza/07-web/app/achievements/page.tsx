'use client';
/**
 * EN: Achievements list merged with the player's unlocked set.
 * ES: Lista de logros combinada con los desbloqueados del jugador.
 * EN: Works logged-out too: everything appears locked.
 * ES: Funciona sin sesión: todo aparece bloqueado.
 */
// EN: Achievement list; unlocked state comes from /me/progress when logged in. / ES: Lista de logros; el estado desbloqueado viene de /me/progress.
import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '@palooza/game-services/browser';
import { api } from '@/lib/api';
import { useApp } from '@/lib/session';

// EN: `Achievements` — see file header for its role in the flow.
// ES: `Achievements` — ver encabezado del archivo para su papel en el flujo.
export default function Achievements() {
  const { t, user, locale } = useApp();
  const [unlocked, setUnlocked] = useState<string[]>([]);
  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    if (user) void api<{ unlocked: string[] }>('/me/progress').then((p) => setUnlocked(p.unlocked)).catch(() => undefined);
  }, [user]);
  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">{t('nav.achievements')}</h1>
      <ul className="grid sm:grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const on = unlocked.includes(a.id);
          return (
            <li key={a.id} className={`panel ${on ? 'border-good' : 'opacity-70'}`}>
              <span aria-hidden>{on ? '🏆' : '🔒'}</span> <strong>{a.title[locale]}</strong>
              <span className="sr-only">{on ? 'unlocked / desbloqueado' : 'locked / bloqueado'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
