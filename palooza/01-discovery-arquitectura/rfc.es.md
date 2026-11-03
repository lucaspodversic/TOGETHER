# RFC-001 — MVP de Palooza: alcance, arquitectura y compuertas

Estado: **Borrador para discovery (Hitos 1–2)**. Es un documento de planificación y no describe ningún producto lanzado.

## 1. Contexto
Palooza es un hub multi-juego propuesto por Together Labs. Tiene una cuenta única, un perfil compartido con progreso, rankings, logros y una capa de recompensas auditable. La integración Web3 es opcional. El brief también menciona juegos tipo casino, apuestas, tokens, marketplace y pagos. Cada uno requiere antes una revisión legal por jurisdicción, verificación de edad, juego responsable y políticas de plataforma. Por eso este RFC **los excluye del MVP**. Solo existen como feature flags en OFF por defecto y sin implementar.

## 2. Alcance del MVP (este repositorio)
| Incluido | Excluido (con compuerta / más adelante) |
|---|---|
| Registro/login, recuperación, sesiones, admin con RBAC | Casino, apuestas |
| Perfil, exportación y borrado (privacidad) | Tokens, pagos, cualquier canje con valor real |
| 3 juegos de habilidad/casuales: memory, reaction, merge2048 | Marketplace / intercambio de ítems |
| Puntaje autoritativo del servidor + anti-abuso | Minteo de NFT en mainnet |
| XP, niveles, logros, puntos de juego no transferibles | Apps móviles nativas |
| Rankings en vivo (WebSocket) | Proveedores reales de email/SMS |
| Vinculación opcional de wallet con SIWE (anvil/Sepolia) | Cadenas mainnet |
| Analítica de eventos con ids seudónimos | SDKs de analítica de terceros |

## 3. Recorridos de usuario
1. **Descubrir y unirse:** inicio → catálogo → registro (elegibilidad por año de nacimiento y región) → login.
2. **Jugar y progresar:** iniciar sesión de juego (el servidor da la semilla) → jugar → enviar el input crudo → el servidor lo reproduce y puntúa → se actualizan XP, logros, puntos y ranking.
3. **Identidad y wallet (opcional):** leer la explicación → pedir el nonce → firmar SIWE (sin gas ni fondos) → vincular o desvincular.
4. **Recompensas:** las reglas son públicas. Cada movimiento queda en un ledger encadenado por hash. El canje responde `403 feature_gated`.
5. **Operar:** el admin revisa las sesiones retenidas, las anula o aprueba, ajusta puntos con un motivo, concilia, cambia flags y lee la auditoría.

## 4. Arquitectura
Ver el diagrama en `rfc.en.md` §4: web (Next.js) → API (Fastify) → identidad, servicios de juego, recompensas y web3. Hay auditoría encadenada y analítica. El contrato PaloozaBadges es soulbound y solo se despliega en anvil o Sepolia. El almacenamiento es en memoria detrás de una interfaz; el adaptador de Postgres se decide en el Hito 3. Por defecto se ata a 127.0.0.1 y los secretos salen solo de env.

## 5. Modelo de amenazas (resumen STRIDE)
| Amenaza | Activo | Control en el repo | Pendiente |
|---|---|---|---|
| Suplantación | cuentas | hash scrypt, sesiones firmadas, rate limit, errores genéricos | MFA |
| Manipulación | puntajes | replay en servidor con semilla, límites de plausibilidad, retención de outliers | tiempo de reacción medido en el cliente |
| Repudio | acciones admin | auditoría encadenada por hash con redacción | almacenamiento WORM externo |
| Fuga de información | PII | emails enmascarados, exportación y borrado, ids seudónimos | política de retención |
| DoS | API | rate limits por ruta, límites de cuerpo | WAF/CDN |
| Escalada | admin | RBAC verificado en servidor, congelamiento | SSO para el staff |
| Phishing de wallet | usuarios | SIWE con dominio, nonce, cadena y expiración; textos explicativos | auditoría independiente |

## 6. Requisitos no funcionales — **A DEFINIR** (propuestas a validar)
Disponibilidad 99,5% mensual · p95 de la API < 300 ms · LCP < 2,5 s · 1k sesiones concurrentes con prueba de carga · RPO 15 min / RTO 4 h · WCAG 2.2 AA · retención de analítica 13 meses y de auditoría 7 años (a confirmar por Legal).

## 7. Decisiones abiertas
Jurisdicciones y edades · base de datos y hosting · cadena y custodia · si las insignias van on-chain · proveedor de email · moderación · definición de KPIs.

## 8. Compuertas de cumplimiento
Todas las flags reguladas quedan en OFF. Aunque se activen, el servidor responde `403 feature_gated` porque la función no está implementada. Implementarlas requiere la aprobación escrita de Legal, Seguridad y Producto.

## 9. Hitos (del brief)
1. Discovery y alcance · 2. UX y arquitectura · 3. Plataforma núcleo (este repo es la línea base) · 4. Integraciones especializadas, solo tras aprobar red, custodia, modelo de amenazas y compuertas · 5. Lanzamiento controlado.
