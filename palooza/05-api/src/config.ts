/**
 * EN: Configuration from environment. Safe defaults: bind 127.0.0.1, all gated features off.
 * ES: Configuración desde el entorno. Valores seguros: escuchar en 127.0.0.1, funciones con compuerta apagadas.
 */
export interface Config {
  host: string;
  port: number;
  sessionSecret: string;
  analyticsSalt: string;
  webOrigin: string;
  siweDomain: string;
  sessionTtlSec: number;
  // EN: Return recovery tokens in the HTTP response (tests/dev only; email delivery is out of scope).
  // ES: Devolver tokens de recuperación en la respuesta HTTP (solo tests/dev; el envío por email está fuera de alcance).
  devExposeRecoveryToken: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const secret = env.SESSION_SECRET ?? '';
  // EN: Fail fast instead of running with a guessable secret. / ES: Fallar rápido en vez de usar un secreto adivinable.
  if (secret.length < 32) throw new Error('SESSION_SECRET (>=32 chars) is required / es obligatorio');
  const webOrigin = env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 4100),
    sessionSecret: secret,
    analyticsSalt: env.ANALYTICS_SALT ?? `${secret}:analytics`,
    webOrigin,
    siweDomain: env.SIWE_DOMAIN ?? new URL(webOrigin).host,
    sessionTtlSec: Number(env.SESSION_TTL_SEC ?? 60 * 60 * 12),
    devExposeRecoveryToken: env.DEV_EXPOSE_RECOVERY_TOKEN === 'true',
  };
}
