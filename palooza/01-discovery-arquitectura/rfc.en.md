# RFC-001 — Palooza MVP: scope, architecture and gates

Status: **Draft for discovery (Milestone 1–2)**. Planning document, not a statement about any shipped product.

## 1. Context
Palooza is a proposed multi-game hub from Together Labs. It has one account, a shared profile with progression, leaderboards, achievements and an auditable reward layer. Web3 integration is optional. The source brief also mentions casino-style games, betting, tokens, a marketplace and payouts. Each of these needs jurisdiction-specific legal, age-gating, responsible-play and platform-policy review first. This RFC therefore **excludes them from the MVP**. They exist only as feature flags that are OFF by default and are not implemented.

## 2. MVP scope (this repository)
| In | Out (gated / later) |
|---|---|
| Signup/login, recovery, sessions, RBAC admin | Casino games, betting, wagering |
| Profile, export and erasure (privacy) | Token rewards, payouts, any real-value redemption |
| 3 skill/casual games: memory, reaction, merge2048 | Marketplace / trading of items |
| Server-authoritative scoring + anti-abuse | NFT minting to mainnet |
| XP, levels, achievements, non-transferable play points | Mobile native apps |
| Live leaderboards (WebSocket) | Real email/SMS delivery providers |
| Optional wallet linking via SIWE (anvil/Sepolia) | Mainnet chains |
| Event analytics with pseudonymous ids | Third-party analytics SDKs |

## 3. User journeys
1. **Discover & join:** land → browse catalogue → sign up (birth year + region eligibility) → log in.
2. **Play & progress:** start a session (server issues seed) → play → submit raw input → server replays it and scores it → XP, achievements, points and leaderboard update.
3. **Identity & wallet (optional):** read the plain-language explanation → request a nonce → sign SIWE (no gas, no funds) → link or unlink.
4. **Rewards:** the rules are published. Every point movement is a hash-chained ledger entry. Redemption returns `403 feature_gated`.
5. **Operate:** an admin reviews held sessions, voids or approves them, adjusts points with a reason, reconciles, toggles flags, and reads the audit log.

## 4. Architecture
```
07-web (Next.js) ──HTTP/WS──> 05-api (Fastify) ──> 02-identity · 03-game-services · 04-rewards
                                   │                       06-web3 (SIWE, chains, tx monitor)
                                   └──> audit log (hash chain) · 08-data-analytics (events/funnel)
06-web3/contracts: PaloozaBadges (soulbound, non-transferable) — local anvil / Sepolia only
```
- Storage is in-memory behind a store interface. A Postgres adapter is a Milestone 3 decision.
- Bind is 127.0.0.1 by default. Secrets come only from env. Rate limits and security headers are on.

## 5. Threat model (STRIDE summary)
| Threat | Asset | Control in repo | Open |
|---|---|---|---|
| Spoofing | accounts | scrypt hashes, signed sessions, login rate limit, generic errors | MFA, breached-password check |
| Tampering | scores | server-side replay with a seed, plausibility bounds, outlier hold | client-measured reaction timing |
| Repudiation | admin actions | hash-chained audit log with redaction | external WORM storage |
| Info disclosure | PII | masked emails, export/erase, pseudonymous analytics ids | retention policy |
| DoS | API | per-route rate limits, body limits | WAF/CDN |
| Elevation | admin | RBAC permissions checked server-side, freeze | SSO for staff |
| Wallet phishing | users | SIWE domain/nonce/chain/expiry checks, explanation copy | independent audit |

## 6. Non-functional requirements — **TBD** (proposals to validate)
| NFR | Proposal (not a commitment) |
|---|---|
| Availability | 99.5% monthly for MVP |
| Latency | p95 < 300 ms API, < 2.5 s LCP |
| Concurrency | design for 1k concurrent sessions, then load-test |
| RPO / RTO | 15 min / 4 h |
| Accessibility | WCAG 2.2 AA |
| Privacy retention | analytics events 13 months, audit 7 years — legal to confirm |

## 7. Open decisions
Target jurisdictions and age thresholds · database and hosting · chain choice and custody assumptions · whether badges go on-chain at all · email provider · moderation policy · KPI definitions.

## 8. Compliance gates
Every regulated flag (`FEATURE_CASINO_GAMES`, `FEATURE_BETTING`, `FEATURE_TOKEN_REWARDS`, `FEATURE_PAYOUTS`, `FEATURE_MARKETPLACE`, `FEATURE_NFT_MINT`) stays OFF. Even when a flag is switched ON, the server still answers `403 feature_gated`, because the feature is not implemented. Implementation needs written sign-off from Legal and Security, plus Product.

## 9. Milestones (from the brief)
1. **Discovery & scope:** users, MVP boundaries, game types, jurisdictions, metrics, ownership.
2. **UX & architecture:** journeys, prototypes, service boundaries, stack, data/security requirements.
3. **Core platform:** accounts, UI, APIs, game sessions, telemetry, tests, deployment (this repo is a reference baseline).
4. **Specialized integrations:** wallet and contract work, only after the network, custody, threat model and review gates are approved.
5. **Controlled release:** usability, load, security and regression testing; support readiness; limited launch; measure and iterate.
