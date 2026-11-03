/**
 * EN: Thin fetch wrapper: JSON, bearer header, typed ApiError.
 * ES: Envoltorio fino de fetch: JSON, header bearer y ApiError tipado.
 * EN: Base URL from NEXT_PUBLIC_API_URL, default 127.0.0.1:4100.
 * ES: URL base desde NEXT_PUBLIC_API_URL, por defecto 127.0.0.1:4100.
 */
/**
 * EN: Typed client for the Palooza API. Token lives in sessionStorage (cleared on tab close),
 *     never in URLs. Base URL defaults to the local API on loopback.
 * ES: Cliente tipado de la API Palooza. El token vive en sessionStorage (se borra al cerrar la
 *     pestaña), nunca en URLs. La URL base por defecto es la API local en loopback.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4100';
// EN: ws:// or wss:// mirroring the API scheme. / ES: ws:// o wss:// según el esquema de la API.
export const WS_URL = API_URL.replace(/^http/, 'ws');
const TOKEN_KEY = 'plz_token';

export interface User { id: string; email: string; displayName: string; role: string; frozen: boolean; wallet: string | null }

// EN: SSR-safe accessors. / ES: Accesores seguros para SSR.
export const getToken = (): string | null => (typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY));
// EN: `setToken` — see file header for its role in the flow.
// ES: `setToken` — ver encabezado del archivo para su papel en el flujo.
export function setToken(t: string | null): void {
  if (t) window.sessionStorage.setItem(TOKEN_KEY, t);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

/** EN: Error with the API's error code. / ES: Error con el código de la API. */
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** EN: JSON fetch with bearer token. / ES: fetch JSON con token bearer. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.authorization = `Bearer ${t}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(`${API_URL}/v1${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new ApiError(r.status, data.error ?? 'error');
  return data as T;
}
