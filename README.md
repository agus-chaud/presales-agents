# PresalesTeam

PresalesTeam es un asistente de prospección y análisis para equipos de preventa, operado desde Telegram.  
Convierte una interacción conversacional en un flujo reproducible: captura contexto, investiga en web con herramientas controladas y devuelve resultados priorizados.

## Contexto y objetivo

El proyecto busca resolver un problema operativo típico de presales: mucho trabajo manual para investigar empresas, sintetizar hallazgos y preparar mensajes de alcance.  
El objetivo es reducir ese tiempo con un agente que mantenga contexto por sesión, use herramientas web de forma segura y persista datos tanto localmente como en la nube.

## Enfoque y decisiones técnicas

### Arquitectura general

- **Interfaz**: bot de Telegram con `grammy`.
- **Núcleo del agente**: loop tipo ReAct en `src/agent`.
- **LLM desacoplado**: frontera `LLMProvider` con `providerManager` para cambiar proveedor sin tocar el loop.
- **Herramientas desacopladas**: patrón de `ToolRegistry` (`nombre -> tool`) para registrar, definir schemas y ejecutar.
- **Persistencia híbrida**: SQLite como primario y Firestore como réplica cloud.

### Por qué no usamos LangChain

No usamos LangChain de forma intencional. Para este caso, el flujo de agente está relativamente controlado (comandos definidos, pocas tools, contrato claro de inputs/outputs) y una capa como LangChain nos habría agregado:

- una dependencia más pesada en tamaño y superficie de APIs,
- mayor complejidad de integración y debugging,
- riesgo de sobre-ingeniería para una orquestación que ya resolvemos con un patrón propio.

En cambio, adoptamos un diseño propio de **providers + tools** que mantiene el código más explícito, predecible y fácil de evolucionar.

## Requisitos

- Node.js 22+ (recomendado por soporte nativo de `--env-file`)
- Cuenta en [Groq](https://console.groq.com) (principal, gratis)
- Cuenta en [OpenRouter](https://openrouter.ai) (fallback, gratis)
- Proyecto en [Firebase](https://console.firebase.google.com/) (opcional para memoria cloud)
- Bot de Telegram creado con [@BotFather](https://t.me/BotFather)

## Instalación y configuración

```bash
# 1) Instalar dependencias
npm install

# 2) Crear archivo de entorno
cp  .env  ## Edita con tus propias credenciales

# 3) Completar credenciales en .env
# - TELEGRAM_BOT_TOKEN
# - GROQ_API_KEY
# - OPENROUTER_API_KEY (fallback)
# - FIREBASE_PROJECT_ID (si activas nube)

# 4) Ejecutar en desarrollo
npm run dev
```

## Persistencia dual (híbrida)

El sistema implementa una estrategia dual para balancear resiliencia y performance:

- **Local (SQLite)**: almacenamiento primario para rapidez y operación local.
- **Cloud (Firestore)**: espejo de seguridad para recuperación y continuidad.
- **Modo cloud-only automático**: si falla la carga de `better-sqlite3`, el bot sigue funcionando solo con Firebase.
- **Consistencia de IDs**: normalización de `session_id` como string en la capa cloud para evitar desalineaciones entre local y remoto.
- **Sincronización robusta**: ante desajustes en updates de empresas, se re-resuelve identidad por `session_id + name` y se reintenta.

## Configuración de Firebase

Para activar memoria en la nube:

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Habilitar **Firestore Database** (modo nativo).
3. Autenticar CLI local con `npx firebase-tools login`.
4. Definir `FIREBASE_PROJECT_ID=tu-proyecto` en `.env`.

## Seguridad de herramientas

La tool `fetch_webpage` aplica restricciones defensivas para reducir riesgo SSRF:

- solo permite protocolos `http` y `https`,
- bloquea destinos locales/privados (`localhost`, `*.local`, loopback, rangos privados IPv4/IPv6, link-local),
- ante validación fallida devuelve error controlado y no ejecuta la request.

## Estructura del proyecto

```text
src/
├── agent/         # Loop del agente y prompts por flujo
├── bot/           # Comandos Telegram, middleware y manejo de sesiones
├── config/        # Validación de entorno (Zod)
├── db/            # Repositorios y persistencia híbrida (SQLite + Firestore)
├── llm/           # Providers LLM (Groq/OpenRouter) y contratos
├── tools/         # Registro y ejecución de herramientas
└── utils/         # Utilidades (logging, sanitización, markdown Telegram)

docs/
└── decisiones-tecnicas.md   # ADRs del proyecto

test/              # Tests de comportamiento
scripts/           # Scripts operativos
```

## Stack

| Componente | Tecnología |
|---|---|
| Interfaz | Telegram (`grammy`) |
| LLM principal | Groq (`llama-3.3-70b-versatile`) |
| LLM fallback | OpenRouter (`meta-llama/llama-3.1-8b-instruct:free`) |
| Persistencia local | SQLite (`better-sqlite3`) |
| Persistencia cloud | Firestore (Firebase) |
| Runtime | Node.js 22+ |
| Lenguaje | TypeScript (ES modules) |

## Notas de operación

- Para validar tipos sin ejecutar build: `npm run typecheck`
- Para correr tests: `npm test`
- Para decisiones de arquitectura y trade-offs: ver `docs/decisiones-tecnicas.md`
