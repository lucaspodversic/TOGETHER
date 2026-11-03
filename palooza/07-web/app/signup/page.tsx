'use client';
/**
 * EN: Signup form: email, display name, password, birth year and region.
 * ES: Formulario de registro: email, nombre visible, contraseña, año de nacimiento y región.
 * EN: Eligibility is enforced by the API; the UI only maps error codes to text.
 * ES: La elegibilidad la aplica la API; la UI solo traduce códigos de error a texto.
 */
// EN: Onboarding: account + eligibility (age/region) in one short form. / ES: Onboarding: cuenta + elegibilidad en un formulario corto.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type User } from '@/lib/api';
import { useApp } from '@/lib/session';

// EN: `Signup` — see file header for its role in the flow.
// ES: `Signup` — ver encabezado del archivo para su papel en el flujo.
export default function Signup() {
  const { t, err, signIn } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ email: '', password: '', displayName: '', birthDate: '', region: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: { ...f, region: f.region.toUpperCase() } });
      signIn(r.token, r.user);
      router.push('/games');
    } catch (x) {
      setMsg(err(x instanceof ApiError ? x.code : 'error'));
    }
  };

  return (
    <form onSubmit={submit} className="panel max-w-sm mx-auto space-y-3" aria-labelledby="su-h">
      <h1 id="su-h" className="text-xl font-bold">{t('nav.signup')}</h1>
      <label className="block">{t('auth.displayName')}<input className="input" required maxLength={32} {...field('displayName')} /></label>
      <label className="block">{t('auth.email')}<input className="input" type="email" autoComplete="email" required {...field('email')} /></label>
      <label className="block">{t('auth.password')}<input className="input" type="password" autoComplete="new-password" minLength={10} required {...field('password')} /></label>
      <label className="block">{t('auth.birthDate')}<input className="input" type="date" required {...field('birthDate')} /></label>
      <label className="block">{t('auth.region')}<input className="input" required maxLength={2} pattern="[A-Za-z]{2}" {...field('region')} /></label>
      <p className="text-xs text-slate-400">{t('auth.ageNote')}</p>
      <button className="btn-primary w-full" type="submit">{t('auth.submit')}</button>
      <p role="alert" className="text-bad text-sm">{msg}</p>
    </form>
  );
}
