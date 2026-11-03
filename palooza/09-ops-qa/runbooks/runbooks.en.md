# Runbooks (EN)

## R1 — Local start
`cp .env.example .env` and set SESSION_SECRET (`openssl rand -hex 32`). Then run `npm run dev:api` and `npm run dev:web`. The API is at http://127.0.0.1:4100 and the web at http://127.0.0.1:3000. With Docker, use `docker compose -f 09-ops-qa/docker-compose.yml --env-file 09-ops-qa/.env up --build`.

## R2 — API unhealthy
1. `curl 127.0.0.1:4100/health`. If `auditChainValid` is false, treat it as a security incident (see R5).
2. Check the logs; authorization headers and passwords are redacted.
3. Restart the API. State is in-memory in this build, so **a restart loses data**. That is a known limitation.

## R3 — Suspected cheating
1. Admin → held sessions (`GET /v1/admin/sessions/held`).
2. Compare the score with the game's plausibility bounds, then approve or void it. Voiding removes the session from leaderboards.
3. For a repeat offender, freeze the account (`POST /v1/admin/users/:id/freeze`). Every action is audited.

## R4 — Points dispute
1. Read the user's ledger in the export or progress view.
2. `POST /v1/admin/reconcile` and check that the hashes and balances match.
3. A manual adjustment needs a written reason. Points have no cash value.

## R5 — Security incident
Freeze the affected accounts, rotate SESSION_SECRET (this invalidates every session), preserve the audit log, and notify Security and Legal. Do not enable any gated flag as a workaround.

## R6 — Flag change request
Regulated flags (casino, betting, tokens, payouts, marketplace, NFT mint) need written Legal and Security sign-off. Even with a flag ON, the API returns 403 because the features are not implemented.
