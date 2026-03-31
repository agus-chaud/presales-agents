# Decisiones Técnicas — PresalesTeam

Registro cronológico de las decisiones técnicas importantes tomadas durante el desarrollo.
Formato: contexto → decisión → alternativas → consecuencias.

---

## DEC-001 — SQLite sobre Engram para persistencia operacional

**Fecha:** 2026-03-08
**Contexto:** Necesitábamos persistir historial de conversaciones, datos de empresas y
sesiones de usuario. El proyecto referencia AI Gentle Stack que recomienda Engram.
**Decisión:** Usar `better-sqlite3` (SQLite) en lugar de Engram.
**Alternativas consideradas:**
- Engram: excelente para artefactos SDD (proposals, specs, diseños), pero está
  diseñado para metadata de workflows de desarrollo, no para datos operacionales.
- Engram requiere un proceso externo o servicio adicional.
**Consecuencias:**
- (+) Sin dependencias externas: SQLite corre en el mismo proceso, sin red.
- (+) Sincrónico: `better-sqlite3` es síncrono, simplifica el código.
- (+) Los repositories abstraen el motor: migrar a Postgres/Firestore más adelante
  requiere cambiar solo la implementación de los repos, no los call sites.
- (-) No hay interfaz visual de Engram para los datos operacionales.
**Nota:** Engram SÍ se usa para los artefactos SDD en `openspec/` (proposal, tasks, etc.).

---

## DEC-002 — LLMProvider interface como frontera de abstracción

**Fecha:** 2026-03-08
**Contexto:** El proyecto necesita Groq como principal y OpenRouter como fallback,
pero en el futuro puede necesitar Anthropic, Gemini, o modelos locales (Ollama).
**Decisión:** Definir `LLMProvider` interface en `src/llm/types.ts`. Ni el agent loop
ni los handlers importan providers concretos — solo `providerManager`.
**Alternativas consideradas:**
- Llamar Groq directamente desde el agent loop: más simple pero acoplado.
- Usar LangChain o LlamaIndex: dependencia pesada, sobre-engineered para este caso.
**Consecuencias:**
- (+) Cambiar de Groq a cualquier otro LLM = un archivo nuevo + registro en ProviderManager.
- (+) El agent loop es completamente agnóstico al proveedor.
- (-) Una capa extra de indirección (mínima complejidad adicional).

---

## DEC-003 — Tool Registry pattern vs imports directos

**Fecha:** 2026-03-08
**Contexto:** El agente necesita un mecanismo para descubrir y ejecutar herramientas.
**Decisión:** `ToolRegistry` como mapa `nombre → Tool`. El agent loop llama
`toolRegistry.getDefinitions()` para obtener los schemas JSON y `toolRegistry.execute()`
para ejecutar. Cada herramienta es un archivo independiente implementando la interface `Tool`.
**Alternativas consideradas:**
- Importar herramientas directamente en el agent loop: hardcoded, no escalable.
- Decorators de TypeScript: más elegante pero requiere `experimentalDecorators`.
**Consecuencias:**
- (+) Añadir una herramienta = un archivo nuevo + una línea en `index.ts`. Nada más.
- (+) El agent loop no sabe cuántas ni cuáles herramientas existen.
- (+) Errores en una herramienta no crashean el loop (try/catch en `execute()`).

---

## DEC-004 — Long polling vs webhooks para desarrollo local

**Fecha:** 2026-03-08
**Contexto:** Telegram puede enviar updates via long polling (bot pregunta) o webhooks
(Telegram pushea a un endpoint HTTP).
**Decisión:** Long polling con `bot.start()` de grammy para desarrollo local.
**Alternativas consideradas:**
- Webhooks: requieren URL pública (ngrok o similar) para desarrollo local.
- Webhooks en producción: sí es el camino correcto para cloud deployment.
**Consecuencias:**
- (+) Cero configuración adicional para correr localmente.
- (+) No necesita servidor web, no expone puertos.
- (+) Migración a webhooks = cambiar `bot.start()` por `webhookCallback(bot, 'express')`.
- (-) Polling consume conexión TCP permanente (mínimo impacto en local).

---

## DEC-005 — Zod para validación de env vars vs dotenv simple

**Fecha:** 2026-03-08
**Contexto:** Las credenciales (.env) son críticas. Si alguna falta, el bot falla
de formas opacas (errores HTTP 401 en runtime, no al arrancar).
**Decisión:** Usar `zod` para parsear y validar `process.env` en `src/config/env.ts`.
Si alguna variable requerida falta o tiene formato incorrecto, `process.exit(1)` con
mensaje claro antes de iniciar cualquier otra cosa.
**Alternativas consideradas:**
- `dotenv` solo: carga las vars pero no valida tipos ni presencia.
- Validación manual con if/throw: verboso y fácil de olvidar una var.
**Consecuencias:**
- (+) El bot nunca arranca en estado roto por credenciales.
- (+) `TELEGRAM_ALLOWED_USER_IDS` se parsea de string CSV a `number[]` una sola vez.
- (+) Zod ya es dependencia de muchos proyectos TS modernos.

---

## DEC-006 — tsx vs ts-node para ejecución en desarrollo

**Fecha:** 2026-03-08
**Contexto:** Se necesita un runner de TypeScript para desarrollo que soporte
ES modules y tenga watch mode.
**Decisión:** Usar `tsx` (usa esbuild internamente).
**Alternativas consideradas:**
- `ts-node`: más establecido pero lento (swc o transpile-only para mitigarlo),
  configuración más compleja con ESM.
- Compilar con `tsc` y correr con `node`: ciclo más lento en desarrollo.
- `bun`: muy rápido pero introduce un runtime no-Node que puede causar
  incompatibilidades con `better-sqlite3` (módulo nativo).
**Consecuencias:**
- (+) `tsx --watch` recarga al guardar, cero configuración.
- (+) Soporta ES modules sin flags adicionales.
- (-) No valida tipos (solo transpila). Por eso existe `npm run typecheck` con `tsc --noEmit`.

---

## DEC-007 — OpenRouter como fallback via openai SDK con baseURL override

**Fecha:** 2026-03-08
**Contexto:** OpenRouter provee modelos gratuitos como fallback cuando Groq llega
al límite de rate. OpenRouter es compatible con la API de OpenAI.
**Decisión:** Usar el SDK oficial de `openai` apuntando a `https://openrouter.ai/api/v1`
mediante `baseURL` override. Modelo: `meta-llama/llama-3.1-8b-instruct:free`.
**Alternativas consideradas:**
- Cliente HTTP propio con fetch: más control pero más código.
- SDK específico de OpenRouter: no existe uno oficial de calidad.
**Consecuencias:**
- (+) Reutilizar el SDK de OpenAI (bien mantenido, tipado completo).
- (+) Cambiar el modelo de OpenRouter = cambiar una string.
- (-) Si OpenRouter cambia su API de OpenAI-compat, el SDK puede fallar.

---

## DEC-008 — groq-sdk oficial vs HTTP directo para Groq

**Fecha:** 2026-03-08
**Contexto:** Se necesita llamar a la API de Groq para inferencia LLM.
**Decisión:** Usar el SDK oficial `groq-sdk`.
**Alternativas consideradas:**
- `fetch` directo: funciona pero sin tipos ni manejo automático de errores.
- SDK de OpenAI con baseURL a Groq: posible pero semánticamente confuso.
**Consecuencias:**
- (+) Tipos completos para requests/responses.
- (+) El SDK maneja automáticamente retries y edge cases de la API.
- (+) API idéntica para Groq y OpenAI facilita el patrón de providers.
---

## DEC-009 — Persistencia Híbrida Cloud-First con tolerancia a fallos

**Fecha:** 2026-03-08
**Contexto:** El usuario solicitó guardar memorias en la nube (Firebase) pero mantener SQLite local. Además, surgieron problemas de compatibilidad con los módulos nativos de `better-sqlite3` en ciertos entornos de Node.js.
**Decisión:** 
1. Implementar un patrón de **Persistencia Dual**: las lecturas/escrituras ocurren en SQLite (primario) y se replican asincrónicamente en Firestore (espejo).
2. Hacer que SQLite sea **opcional**: envolver la inicialización de `better-sqlite3` en un bloque `try/catch` usando `createRequire` para manejar fallos de carga de binarios nativos.
3. Si SQLite falla, el sistema entra en modo "Cloud-only", garantizando que el bot no crashee y los datos se guarden en Firebase.
**Alternativas consideradas:**
- Forzar la reparación de SQLite: difícil de automatizar para todos los entornos de usuario (requiere herramientas de compilación de C++).
- Migrar 100% a la nube: descartado para mantener la posibilidad de uso offline y rapidez local.
**Consecuencias:**
- (+) El bot es extremadamente resiliente: funciona con nube, con local o con ambos.
- (+) Los datos están siempre respaldados en Firebase si el ID de proyecto está presente.
- (+) Se eliminaron los fallos de arranque por variables de entorno usando `--env-file` (Node 22+).
- (-) El código de los repositorios es más complejo (maneja chequeos de disponibilidad).

---

## DEC-010 — Tavily (primario) + Brave Search (fallback) para búsqueda web

**Fecha:** 2026-03-16
**Contexto:** El agente de prospección de leads necesita buscar empresas en la web. Se evaluaron varias APIs de búsqueda.
**Decisión:** Tavily como primario, Brave Search API como fallback automático en `webSearch.ts`.
**Alternativas consideradas:**
- SerpAPI: necesita tarjeta de crédito incluso para free tier.
- DuckDuckGo scraping: sin API key pero frágil ante cambios de HTML.
- Google Custom Search: cuota muy baja en free tier (100 queries/día).
**Consecuencias:**
- (+) Tavily devuelve contenido pre-extraído (no solo URLs), ideal para LLMs.
- (+) Ambas tienen free tiers generosos (1000 y 2000 req/mes respectivamente).
- (+) El failover es transparente para el agente — no necesita saber cuál se usa.
- (-) Requiere dos API keys opcionales en .env.

---

## DEC-011 — Jina.ai Reader para lectura de páginas web (sin API key)

**Fecha:** 2026-03-16
**Contexto:** El agente de leads y de análisis necesitan leer el contenido de páginas web de empresas.
**Decisión:** `https://r.jina.ai/{url}` devuelve Markdown limpio de cualquier URL, sin autenticación.
**Alternativas consideradas:**
- Puppeteer/Playwright: necesita Chromium, demasiado pesado para este caso.
- Cheerio + fetch: HTML crudo, requiere parsing, frágil ante JavaScript-heavy sites.
- ScrapingBee / BrightData: de pago.
**Consecuencias:**
- (+) Cero setup: no requiere API key ni dependencias adicionales.
- (+) Markdown limpio es exactamente lo que necesita el LLM para procesar.
- (+) Maneja JavaScript-heavy sites (Jina renderiza server-side).
- (-) Dependencia de un servicio externo gratuito (puede agregar rate limits en el futuro).
- (-) No es fallback de Tavily — son complementarios (Tavily busca, Jina.ai lee).

---

## DEC-012 — Flujo de leads separado del flujo de análisis de prospectos

**Fecha:** 2026-03-16
**Contexto:** El bot tenía un solo modo: el usuario trae una empresa ya conocida y el bot la analiza. Se agregó un modo proactivo donde el bot busca empresas por cuenta propia.
**Decisión:** Nuevo comando `/leads` con su propio wizard (1 paso), prompt del sistema separado (`leadsPrompt.ts`), y wizard state `leadsStep` independiente. Reutiliza el mismo `runAgentLoop` pero con `systemPrompt` override.
**Alternativas consideradas:**
- Integrar leads en el flujo de `/analyze`: confuso para el usuario, prompts contradictorios.
- Crear un segundo agent loop: duplicación innecesaria de código.
**Consecuencias:**
- (+) Prompts independientes optimizados para cada caso de uso.
- (+) Reutiliza `runAgentLoop` vía el campo `systemPrompt` en `AgentInput`.
- (+) Los estados de wizard no interfieren entre sí.
- (-) Una capa adicional de routing en el catch-all de `bot.ts`.

---

## DEC-013 — Colección `leads` separada de `companies` en Firestore

**Fecha:** 2026-03-16
**Contexto:** `companies` ya existía para guardar prospectos analizados en el flujo de `/analyze`. Los leads descubiertos por el agente son una entidad diferente.
**Decisión:** Nueva colección `leads` en Firestore con schema propio (`fit_score`, `fit_signals`, `why_fit`, `search_query`, `status`).
**Alternativas consideradas:**
- Reutilizar `companies` con un tipo discriminante: schema incompatible, queries más complejas.
**Consecuencias:**
- (+) Separación clara: `leads` = candidatos descubiertos, `companies` = prospectos ya en proceso.
- (+) Permite estadísticas y filtros independientes por colección.
- (+) El schema de `leads` captura la razón del fit (campo `why_fit`), información ausente en `companies`.

---

## DEC-014 — Normalización de IDs híbridos y hardening de `fetch_webpage`

**Fecha:** 2026-03-31
**Contexto:** Quedaron dos bugs altos abiertos:
1. Riesgo de inconsistencia SQLite/Firestore por mezcla de IDs numéricos (local) y string (cloud), especialmente en sincronización de `messages` y updates de `companies`.
2. Validación insuficiente de destinos en `fetch_webpage`, permitiendo targets locales/privados y protocolos no deseados.

**Decisión:**
1. Normalizar `session_id` como `string` en la capa Firestore para `messages` y `companies` (insert, query y clear).
2. En `companyRepo`, cuando un update cloud por `id` falla, resolver identidad por clave natural (`session_id` + `name`) desde SQLite, hacer `upsert` en Firestore y reintentar el update con el `id` cloud real.
3. Endurecer `fetch_webpage` para aceptar solo `http/https` y bloquear destinos locales/privados (`localhost`, `*.local`, rangos privados IPv4/IPv6 y loopback/link-local).

**Alternativas consideradas:**
- Unificar todas las IDs con migración de schema (alto costo y riesgo en caliente).
- Desactivar sync cloud de updates cuando hay ID local (evita errores pero pierde consistencia).
- Permitir cualquier URL y delegar seguridad al proxy externo (insuficiente para hardening del agente).

**Consecuencias:**
- (+) Reduce errores silenciosos de sincronización entre local/cloud.
- (+) `fetch_webpage` baja superficie de abuso/SSRF hacia destinos internos.
- (+) Se agregaron tests de comportamiento para validación de URL pública vs privada.
- (-) Update de `companies` en cloud puede hacer una consulta extra en SQLite + un `upsert` en fallback.

---

## DEC-015 — Hardening de Telegram Markdown y parseo estricto de tool arguments

**Fecha:** 2026-03-31  
**Contexto:** Había dos bugs altos pendientes:
1. Texto dinámico de usuario/LLM se enviaba con `parse_mode: 'Markdown'` sin escape, provocando errores de parseo o formato inesperado.
2. Cuando un provider devolvía JSON inválido en `tool_calls.function.arguments`, el sistema seguía con `{}` en vez de frenar esa tool-call.

**Decisión:**
1. Crear `escapeTelegramMarkdown()` y aplicarlo a campos dinámicos mostrados con Markdown en comandos de bot (`analyze`, `leads`, `setupProfile`, `start`).
2. En respuestas largas/raw del LLM en `analyze` y fallback de `leads`, no forzar `parse_mode: 'Markdown'`.
3. Unificar parseo de argumentos en `parseToolArguments()` y cambiar el comportamiento a **fail-closed**:
   - Si no parsea JSON o no es objeto, retorna `null`.
   - Los providers (`groq` y `openrouter`) descartan esa tool-call en lugar de ejecutar con `{}`.

**Alternativas consideradas:**
- Migrar todo a `MarkdownV2` de Telegram (más estricto pero más invasivo).
- Mantener fallback a `{}` con warnings (ya probado: genera errores silenciosos de negocio).

**Consecuencias:**
- (+) Baja fuerte de mensajes fallidos por caracteres especiales en input del usuario o salida del LLM.
- (+) Se elimina ejecución silenciosa de tools con argumentos vacíos.
- (+) Comportamiento más predecible: o hay argumentos válidos, o la tool-call no se ejecuta.
- (-) Si el LLM emite JSON inválido repetidamente, habrá menos llamadas a tools hasta corregir prompt/modelo.
- (+) Se agregaron tests de comportamiento para escape Markdown y parseo de tool arguments.
