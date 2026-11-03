'use client';
/**
 * EN: Top navigation with locale switch and session-aware links.
 * ES: Navegación superior con selector de idioma y enlaces según la sesión.
 * EN: Admin link shows only for staff roles; the API still enforces access.
 * ES: El enlace admin aparece solo para roles staff; la API igual controla el acceso.
 */
/**
 * EN: Top navigation with language toggle and a permanent "no cash value" banner.
 * ES: Navegación superior con selector de idioma y aviso permanente de "sin valor monetario".
 */
import Link from 'next/link';
import { useApp } from '@/lib/session';

// EN: `Nav` — see file header for its role in the flow.
// ES: `Nav` — ver encabezado del archivo para su papel en el flujo.
export function Nav() {
  const { user, t, locale, setLocale, logout } = useApp();
  // EN: Hiding links is UX only; the API enforces RBAC. / ES: Ocultar enlaces es solo UX; la API aplica RBAC.
  const staff = user && ['admin', 'moderator', 'support'].includes(user.role);
  return (
    <header className="flex flex-wrap items-center gap-4 px-4 py-2 border-b border-edge bg-panel">
      <Link href="/" className="font-extrabold text-lg text-pop">Palooza</Link>
      <nav aria-label="Main" className="flex flex-wrap gap-3 text-slate-300">
        <Link href="/games">{t('nav.games')}</Link>
        <Link href="/leaderboards">{t('nav.leaderboards')}</Link>
        <Link href="/achievements">{t('nav.achievements')}</Link>
        {user && <Link href="/profile">{t('nav.profile')}</Link>}
        {user && <Link href="/wallet">{t('nav.wallet')}</Link>}
        {staff && <Link href="/admin">{t('nav.admin')}</Link>}
      </nav>
      <span className="text-xs px-2 py-0.5 rounded bg-zap/15 text-zap">{t('banner.points')}</span>
      <div className="ml-auto flex items-center gap-2">
        <button className="btn" onClick={() => setLocale(locale === 'en' ? 'es' : 'en')} aria-label="Change language / Cambiar idioma">
          {t('common.lang')}
        </button>
        {user ? (
          <>
            <span className="text-slate-400">{user.displayName}</span>
            <button className="btn" onClick={() => void logout()}>{t('nav.logout')}</button>
          </>
        ) : (
          <>
            <Link className="btn" href="/login">{t('nav.login')}</Link>
            <Link className="btn-primary" href="/signup">{t('nav.signup')}</Link>
          </>
        )}
      </div>
    </header>
  );
}
