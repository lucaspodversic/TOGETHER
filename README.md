# Palooza — reference implementation / implementación de referencia

**EN:** This is a TypeScript monorepo for a Palooza MVP: a multi-game hub with accounts, server-authoritative casual/skill games, progression, leaderboards, an auditable rewards ledger and optional SIWE wallet linking (local anvil / Sepolia only). Casino, betting, token, payout, marketplace and NFT-mint features are **not implemented**. They sit behind flags that are OFF by default, pending legal review.

**ES:** Es un monorepo TypeScript para un MVP de Palooza: un hub multi-juego con cuentas, juegos casuales y de habilidad con puntaje autoritativo del servidor, progreso, rankings, un ledger de recompensas auditable y vinculación opcional de wallet con SIWE (solo anvil local o Sepolia). Casino, apuestas, tokens, pagos, marketplace y minteo de NFT **no están implementados**. Quedan detrás de flags en OFF por defecto hasta la revisión legal.

| Folder / Carpeta | Content / Contenido |
|---|---|
| 01-discovery-arquitectura | RFC EN/ES: scope, journeys, architecture, threat model, NFRs (TBD), milestones |
| 02-identity | passwords, sessions, RBAC, eligibility, recovery tokens |
| 03-game-services | memory, reaction, merge2048; seeded replay; anti-abuse; leaderboards |
| 04-rewards | XP/levels, achievements, hash-chained play-points ledger |
| 05-api | Fastify API + WebSocket, audit log, admin, gated routes |
| 06-web3 | SIWE, chain allow-list, tx monitor, PaloozaBadges (Foundry) |
| 07-web | Next.js + Tailwind UI, EN/ES, accessible |
| 08-data-analytics | event schema, pseudonymisation, funnel CLI |
| 09-ops-qa | compose, Dockerfiles, CI, runbooks, checklists, density gate |
| 10-talent-plan | hiring plan (estimates), CV and note templates |

## Quick start / Inicio rápido
```bash
npm install
cp .env.example .env   # EN: set SESSION_SECRET / ES: definir SESSION_SECRET
npm test               # EN: all workspaces, offline / ES: todos los workspaces, offline
npm run dev:api        # 127.0.0.1:4100
npm run dev:web        # 127.0.0.1:3000
npm run contracts:test # EN: needs Foundry / ES: requiere Foundry
node 09-ops-qa/scripts/comment-density.mjs --min 25
```

## Known limitations / Limitaciones conocidas
- EN: In-memory storage; a restart clears data. / ES: Almacenamiento en memoria; reiniciar borra los datos.
- EN: Reaction time is client-measured and only bounds-checked. / ES: El tiempo de reacción se mide en el cliente y solo se acota.
- EN: Recovery email is an integration point (dev token flag only). / ES: El email de recuperación es un punto de integración (solo token de desarrollo).
- EN: Not audited; not for production. / ES: Sin auditoría; no apto para producción.

License / Licencia: MIT — `[COPYRIGHT HOLDER]`.
