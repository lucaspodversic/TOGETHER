# Test strategy (EN)
| Layer | Tooling | What it covers |
|---|---|---|
| Unit | vitest | password policy, sessions, RBAC, eligibility; deterministic game replay; anti-abuse; rewards ledger hash chain; analytics funnel |
| API | vitest + Fastify `inject` | every route: auth, validation, gated 403s, admin permissions, audit chain; WebSocket leaderboard |
| Web | vitest | i18n coverage EN/ES, error text mapping, progress helpers; `next build` as a compile check |
| Contracts | Foundry | soulbound badges: mint roles, no transfers, events |
| Integration | vitest + local anvil | deploy and read the badge contract (skipped if anvil is absent) |
| Manual | checklist | accessibility, cross-browser, usability (Milestone 5) |
| Future | k6 / Playwright | load, and E2E against the compose stack |

Everything runs offline, with no third-party services.
