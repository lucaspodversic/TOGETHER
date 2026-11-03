'use client';
/**
 * EN: App context: token, locale, current user; token is kept in memory, not localStorage.
 * ES: Contexto de la app: token, idioma y usuario; el token vive en memoria, no en localStorage.
 * EN: Trade-off: a reload logs out, which reduces XSS token theft exposure.
 * ES: Compromiso: recargar cierra sesión, lo que reduce la exposición al robo de token por XSS.
 */
/**
 * EN: App context: current user, locale and auth helpers shared by all pages.
 * ES: Contexto de la app: usuario actual, idioma y helpers de auth compartidos por todas las páginas.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type User } from './api';
import { detectLocale, errorText, translate, type Locale, type MsgKey } from './i18n';

interface Ctx {
  user: User | null;
  ready: boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: MsgKey) => string;
  err: (code: string) => string;
  refresh: () => Promise<void>;
  signIn: (token: string, user: User) => void;
  logout: () => Promise<void>;
}
const AppCtx = createContext<Ctx | null>(null);

// EN: `AppProvider` — see file header for its role in the flow.
// ES: `AppProvider` — ver encabezado del archivo para su papel en el flujo.
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<Locale>('en');

  // EN: Resolve the user from the stored token; invalid token = logged out.
  // ES: Resuelve el usuario desde el token; token inválido = sin sesión.
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser((await api<{ user: User }>('/me')).user);
    } catch {
      setToken(null);
      setUser(null);
    }
    setReady(true);
  }, []);

  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    // EN: Saved preference wins over browser language. / ES: La preferencia guardada gana al idioma del navegador.
    const saved = window.localStorage.getItem('plz_locale');
    setLocaleState(saved === 'es' || saved === 'en' ? saved : detectLocale(navigator.language));
    void refresh();
  }, [refresh]);

  // EN: Effect re-runs only when its dependency list changes; cleanup avoids stale updates.
  // ES: El efecto se repite solo si cambian sus dependencias; la limpieza evita actualizaciones obsoletas.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    window.localStorage.setItem('plz_locale', l);
    setLocaleState(l);
  };
  const signIn = (token: string, u: User) => {
    setToken(token);
    setUser(u);
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setUser(null);
  };

  return (
    <AppCtx.Provider value={{ user, ready, locale, setLocale, t: (k) => translate(locale, k), err: (c) => errorText(locale, c), refresh, signIn, logout }}>
      {children}
    </AppCtx.Provider>
  );
}

// EN: `useApp` — see file header for its role in the flow.
// ES: `useApp` — ver encabezado del archivo para su papel en el flujo.
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
