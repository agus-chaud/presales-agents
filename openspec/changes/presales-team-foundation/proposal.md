# Proposal: presales-team-foundation

## Intent
Construir la fundación completa del bot PresalesTeam: un agente de IA local
que opera vía Telegram, usa Groq como LLM principal (con OpenRouter como
fallback), ejecuta herramientas mediante un agent loop con límite de iteraciones,
y persiste datos en SQLite.

## Scope

### Incluido
- Bot de Telegram con grammy (long polling, sin servidor web)
- Whitelist de user IDs con middleware de autenticación
- Capa LLM con interfaz abstracta (Groq + OpenRouter)
- Tool registry con herramienta demo: get_current_time
- Agent loop con límite de iteraciones configurable
- Persistencia SQLite: sessions, messages, companies
- Validación de env vars con Zod (fallo rápido si faltan credenciales)
- Rate limiting por usuario (token bucket en memoria)
- Documentación de decisiones técnicas en español

### Excluido
- Herramientas de investigación web (siguiente iteración)
- Generación de informes priorizados (siguiente iteración)
- Despliegue en la nube
- Tests automatizados

## Approach
Implementación bottom-up siguiendo el orden de dependencias:
config → utils → llm → tools → db → agent → bot → index

## Affected Areas
| Área | Cambio |
|------|--------|
| / | package.json, tsconfig.json, .env.example, .gitignore |
| src/config/ | env.ts (Zod) |
| src/utils/ | logger.ts, sanitize.ts |
| src/llm/ | types.ts, groqProvider.ts, openRouterProvider.ts, providerManager.ts |
| src/tools/ | types.ts, registry.ts, implementations/getCurrentTime.ts |
| src/db/ | schema.ts, database.ts, repositories/ |
| src/agent/ | types.ts, prompts.ts, agentLoop.ts |
| src/bot/ | middleware/auth.ts, middleware/rateLimit.ts, commands/, bot.ts |
| src/ | index.ts |
| docs/ | decisiones-tecnicas.md |

## Rollback Plan
El proyecto empieza vacío. Rollback = borrar los archivos creados.

## Success Criteria
- `npm install` sin errores
- `npm run typecheck` sin errores TypeScript
- `npm run dev` inicia el bot (long polling activo)
- /start desde usuario en whitelist → respuesta
- Texto libre → agent loop corre, get_current_time puede ejecutarse
- Usuario fuera de whitelist → drop silencioso, warning en logs
