# PresalesTeam

Equipo de agentes de IA para presales que combina potencia local con persistencia en la nube. Usa Telegram como interfaz principal.

Envías una lista de empresas → los agentes investigan, analizan y redactan mensajes personalizados → recibes un informe ordenado por prioridad.

## Requisitos

- Node.js 22+ (recomendado por soporte nativo de `--env-file`)
- Cuenta en [Groq](https://console.groq.com) (gratis)
- Cuenta en [OpenRouter](https://openrouter.ai) (gratis, fallback)
- Proyecto en [Firebase](https://console.firebase.google.com/) (opcional, para memoria en la nube)
- Bot de Telegram creado con [@BotFather](https://t.me/BotFather)

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar credenciales
cp .env.example .env
# Editar .env con tus valores reales (incluyendo FIREBASE_PROJECT_ID si quieres nube)

# 3. Iniciar en modo desarrollo
npm run dev
```

## Persistencia Dual (Híbrida)

El sistema usa una arquitectura de persistencia dual:
- **Local (SQLite)**: Almacenamiento primario para velocidad instantánea y funcionamiento offline.
- **Nube (Firestore)**: Espejo en tiempo real. Si la base local falla o se pierde, los datos están seguros en Firebase.
- **Tolerancia a fallos**: Si los módulos nativos de SQLite no están disponibles en tu sistema, el bot funcionará automáticamente en "Cloud-only mode" usando solo Firebase.
- **Consistencia de IDs**: La capa cloud normaliza `session_id` como string para evitar desalineaciones entre IDs numéricos locales y documentos en Firestore.
- **Sincronización robusta de empresas**: Cuando un update cloud por `id` no coincide con SQLite, el sistema re-resuelve por `session_id + name` y reintenta automáticamente.

## Configuración de Firebase

Para activar la memoria en la nube:
1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/).
2. Habilita **Firestore Database** en modo nativo.
3. Asegúrate de estar logueado en tu PC (`npx firebase-tools login`).
4. Añade `FIREBASE_PROJECT_ID=tu-id` a tu `.env`.

## Seguridad de herramientas web

- `fetch_webpage` acepta solo URLs `http/https`.
- Se bloquean destinos locales o privados por seguridad (`localhost`, `*.local`, loopback y redes privadas IPv4/IPv6).
- Si la URL no pasa validación, la herramienta devuelve error controlado y no realiza la request.

## Estructura del proyecto

```
src/
├── config/        # Validación de variables de entorno (Zod)
├── bot/           # Bot de Telegram (grammy) + middleware
├── agent/         # Agent loop (ReAct pattern)
├── llm/           # Abstracción LLM (Groq + OpenRouter)
├── tools/         # Sistema de herramientas del agente
├── db/            # Persistencia Dual (SQLite + Firestore)
└── utils/         # Logger, sanitización
```

## Stack

| Componente | Tecnología |
|---|---|
| Interfaz | Telegram (grammy) |
| LLM principal | Groq — Llama 3.3 70B |
| LLM fallback | OpenRouter — Llama 3.1 8B |
| Nube | Firebase (Firestore) |
| Local | SQLite (better-sqlite3) |
| Runtime | Node.js (v22+) + tsx |
| Lenguaje | TypeScript (ES modules) |
