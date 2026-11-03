'use client';
/**
 * EN: Login form; stores the session token in memory via useApp().
 * ES: Formulario de login; guarda el token de sesión en memoria vía useApp().
 * EN: Generic error text so the UI never reveals whether an email exists.
 * ES: Texto de error genérico para no revelar si un email existe.
 */
// EN: Login + password-recovery request. / ES: Login + solicitud de recuperación de contraseña.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type User } from '@/lib/api';
import { useApp } from '@/lib/session';

// EN: `Login` — see file header for its role in the flow.
// ES: `Login` — ver encabezado del archivo para su papel en el flujo.
export default function Login() {
  const { t, err, signIn } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      signIn(r.token, r.user);
      router.push('/games');
    } catch (x) {
      setMsg(err(x instanceof ApiError ? x.code : 'error'));
    }
  };
  // EN: Always the same answer (no account enumeration). / ES: Siempre la misma respuesta (sin enumeración).
  const forgot = async () => {
    await api('/auth/recovery/request', { method: 'POST', body: { email } }).catch(() => undefined);
    setMsg('If the account exists, a reset link was sent. / Si la cuenta existe, se envió un enlace.');
  };

  return (
    <form onSubmit={submit} className="panel max-w-sm mx-auto space-y-3" aria-labelledby="login-h">
      <h1 id="login-h" className="text-xl font-bold">{t('nav.login')}</h1>
      <label className="block">{t('auth.email')}<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block">{t('auth.password')}<input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn-primary w-full" type="submit">{t('auth.submit')}</button>
      <button className="text-zap underline text-xs" type="button" onClick={() => void forgot()}>{t('auth.forgot')}</button>
      <p role="status" className="text-sm text-slate-300">{msg}</p>
    </form>
  );
}
