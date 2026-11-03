# 09 — Ops & QA / Operaciones y QA
- `docker-compose.yml`: anvil + api + web; ports bound to 127.0.0.1 / puertos atados a 127.0.0.1
- `docker/Dockerfile.node`, `docker/Dockerfile.web`: non-root images / imágenes sin root
- `ci/ci.yml` (= `/.github/workflows/ci.yml`): typecheck, tests, web build, density, contracts, compose
- `runbooks/`, `release-checklist.*.md`, `test-strategy.*.md`: EN + ES
- `scripts/comment-density.mjs`: gate ≥ 25% for packages 02–08 / control ≥ 25% para paquetes 02–08
