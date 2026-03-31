# Tasks: presales-team-foundation

## Fase 1: Configuración del proyecto
- [x] 1.1 Crear package.json con dependencias y scripts npm
- [x] 1.2 Crear tsconfig.json con NodeNext modules + strict mode
- [x] 1.3 Crear .gitignore (excluye .env, node_modules, data/, dist/)
- [x] 1.4 Crear src/config/env.ts con validación Zod
- [x] 1.5 Crear src/utils/logger.ts (wrapper delgado de console)
- [x] 1.6 Crear src/utils/sanitize.ts (longitud + control chars)

## Fase 2: Capa LLM
- [x] 2.1 Crear src/llm/types.ts (LLMProvider interface, Message, LLMResponse)
- [x] 2.2 Crear src/llm/groqProvider.ts (groq-sdk, llama-3.3-70b-versatile)
- [x] 2.3 Crear src/llm/openRouterProvider.ts (openai SDK + baseURL override)
- [x] 2.4 Crear src/llm/providerManager.ts (failover Groq → OpenRouter)

## Fase 3: Sistema de herramientas
- [x] 3.1 Crear src/tools/types.ts (Tool, ToolResult, ToolSchema interfaces)
- [x] 3.2 Crear src/tools/registry.ts (ToolRegistry class)
- [x] 3.3 Crear src/tools/implementations/getCurrentTime.ts

## Fase 4: Base de datos
- [x] 4.1 Crear src/db/schema.ts (CREATE TABLE strings)
- [x] 4.2 Crear src/db/database.ts (singleton better-sqlite3 + migraciones)
- [x] 4.3 Crear src/db/repositories/sessionRepo.ts
- [x] 4.4 Crear src/db/repositories/messageRepo.ts
- [x] 4.5 Crear src/db/repositories/companyRepo.ts

## Fase 5: Agent Loop
- [x] 5.1 Crear src/agent/types.ts (AgentInput, AgentResult, AgentState)
- [x] 5.2 Crear src/agent/prompts.ts (system prompt de presales)
- [x] 5.3 Crear src/agent/agentLoop.ts (loop con límite de iteraciones)

## Fase 6: Bot Telegram
- [x] 6.1 Crear src/bot/middleware/auth.ts (whitelist enforcement)
- [x] 6.2 Crear src/bot/middleware/rateLimit.ts (token bucket por usuario)
- [x] 6.3 Crear src/bot/commands/start.ts
- [x] 6.4 Crear src/bot/commands/help.ts
- [x] 6.5 Crear src/bot/commands/analyze.ts (handler principal)
- [x] 6.6 Crear src/bot/bot.ts (middleware chain + command routing)

## Fase 7: Entry point y documentación
- [x] 7.1 Crear src/index.ts (wires everything + bot.start())
- [x] 7.2 Crear .env.example
- [x] 7.3 Crear docs/decisiones-tecnicas.md
- [x] 7.4 Crear README.md
