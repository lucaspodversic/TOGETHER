/**
 * EN: Process entry point: load config, build the app, listen on 127.0.0.1 unless HOST overrides.
 * ES: Punto de entrada del proceso: carga config, arma la app, escucha en 127.0.0.1 salvo que HOST lo cambie.
 */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { app } = await buildApp({
    config,
    logger: true,
    // EN: Optional first admin from env only. / ES: Admin inicial opcional solo desde env.
    bootstrapAdmin: process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD ? { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } : undefined,
  });
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void app.close().then(() => process.exit(0)));
  await app.listen({ host: config.host, port: config.port });
}

main().catch((e) => {
  console.error('[api] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
