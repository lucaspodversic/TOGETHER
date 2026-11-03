# Estrategia de pruebas (ES)
| Capa | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | vitest | política de contraseñas, sesiones, RBAC, elegibilidad; replay determinista; anti-abuso; ledger encadenado; embudo de analítica |
| API | vitest + `inject` de Fastify | todas las rutas: auth, validación, 403 con compuerta, permisos admin, cadena de auditoría; WebSocket |
| Web | vitest | cobertura i18n EN/ES, mapeo de errores, helpers de progreso; `next build` como chequeo de compilación |
| Contratos | Foundry | insignias soulbound: roles de minteo, sin transferencias, eventos |
| Integración | vitest + anvil local | desplegar y leer el contrato (se omite sin anvil) |
| Manual | checklist | accesibilidad, navegadores, usabilidad (Hito 5) |
| Futuro | k6 / Playwright | carga, y E2E contra el stack de compose |

Todo corre offline, sin servicios de terceros.
