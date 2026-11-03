# Runbooks (ES)

## R1 — Arranque local
`cp .env.example .env` y definir SESSION_SECRET (`openssl rand -hex 32`). Después correr `npm run dev:api` y `npm run dev:web`. La API queda en http://127.0.0.1:4100 y la web en http://127.0.0.1:3000. Con Docker: `docker compose -f 09-ops-qa/docker-compose.yml --env-file 09-ops-qa/.env up --build`.

## R2 — API sin salud
1. `curl 127.0.0.1:4100/health`. Si `auditChainValid` es false, tratarlo como incidente de seguridad (ver R5).
2. Revisar los logs; los headers de autorización y las contraseñas están redactados.
3. Reiniciar la API. El estado vive en memoria en esta versión, así que **reiniciar pierde los datos**. Es una limitación conocida.

## R3 — Sospecha de trampa
1. Admin → sesiones retenidas.
2. Comparar el puntaje con los límites de plausibilidad y aprobar o anular. Anular saca la sesión de los rankings.
3. Si es reincidente, congelar la cuenta. Todo queda auditado.

## R4 — Disputa de puntos
1. Ver el ledger del usuario en la exportación o en el progreso.
2. `POST /v1/admin/reconcile` y confirmar que hashes y saldos coinciden.
3. Un ajuste manual necesita un motivo escrito. Los puntos no tienen valor monetario.

## R5 — Incidente de seguridad
Congelar las cuentas afectadas, rotar SESSION_SECRET (invalida todas las sesiones), preservar la auditoría y avisar a Seguridad y Legal. No activar ninguna flag con compuerta como parche.

## R6 — Pedido de cambio de flag
Las flags reguladas requieren aprobación escrita de Legal y Seguridad. Aunque estén en ON, la API responde 403 porque las funciones no están implementadas.
