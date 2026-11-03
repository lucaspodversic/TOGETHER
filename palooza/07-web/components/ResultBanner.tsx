'use client';
/**
 * EN: Result banner: score, XP, points and held-for-review notice.
 * ES: Banner de resultado: puntaje, XP, puntos y aviso de revisión.
 * EN: role=status so screen readers announce the outcome.
 * ES: role=status para que los lectores de pantalla anuncien el resultado.
 */
// EN: Accessible result announcement (aria-live). / ES: Anuncio accesible del resultado (aria-live).
import type { SubmitResult } from './useGameSession';
import { useApp } from '@/lib/session';

// EN: `ResultBanner` — see file header for its role in the flow.
// ES: `ResultBanner` — ver encabezado del archivo para su papel en el flujo.
export function ResultBanner({ result, error, recorded }: { result: SubmitResult | null; error: string | null; recorded: boolean }) {
  const { t } = useApp();
  return (
    <div aria-live="polite" className="min-h-6">
      {!recorded && <p className="text-slate-400">{t('game.loginNeeded')}</p>}
      {error && <p className="text-bad">{error}</p>}
      {result && (
        <p className={result.status === 'accepted' ? 'text-good' : 'text-bad'}>
          {t(`game.status.${result.status}` as 'game.status.accepted')} — {result.score} {result.reason ? `(${result.reason})` : ''} · {t('profile.points')}: {result.points}
        </p>
      )}
    </div>
  );
}
