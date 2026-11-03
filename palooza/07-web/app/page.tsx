'use client';
/**
 * EN: Landing page: pitches the casual games and links to signup/play.
 * ES: Página de inicio: presenta los juegos casuales y enlaza a registro/jugar.
 * EN: Static; no API calls so it renders even when the API is down.
 * ES: Estática; sin llamadas a la API para que cargue aunque la API esté caída.
 */
// EN: Landing / onboarding entry. / ES: Portada / entrada al onboarding.
import Link from 'next/link';
import { useApp } from '@/lib/session';

// EN: `Home` — see file header for its role in the flow.
// ES: `Home` — ver encabezado del archivo para su papel en el flujo.
export default function Home() {
  const { t, user } = useApp();
  return (
    <section className="py-12 text-center space-y-6">
      <h1 className="text-3xl font-extrabold">{t('home.title')}</h1>
      <div className="flex justify-center gap-3">
        {!user && <Link className="btn-primary" href="/signup">{t('home.cta')}</Link>}
        <Link className="btn" href="/games">{t('home.play')}</Link>
      </div>
    </section>
  );
}
