// DECISIÓN DEC-005: Zod valida todas las vars de entorno al arrancar.
// Si alguna falta o tiene formato incorrecto, process.exit(1) con mensaje claro
// antes de iniciar el bot. Esto previene arranques en estado roto.
import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN es requerido'),

  // DECISIÓN: TELEGRAM_ALLOWED_USER_IDS viene como CSV ("123,456")
  // y se parsea a number[] una sola vez al arrancar.
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1, 'TELEGRAM_ALLOWED_USER_IDS es requerido')
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map(Number)
    ),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY es requerido'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY es requerido'),

  DB_PATH: z.string().default('./data/presales.db'),

  // FIREBASE CONFIG
  FIREBASE_PROJECT_ID: z.string().optional(),
  // Opcional: Ruta a archivo JSON de service account. 
  // Si no se provee, usa Application Default Credentials.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Búsqueda web para el agente de leads (DEC-010)
  // Tavily: primario — diseñada para agentes IA, free tier 1000 req/mes
  TAVILY_API_KEY: z.string().optional(),
  // Brave Search: fallback — free tier 2000 req/mes
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // Límite de iteraciones del agent loop (DEC seguridad: evita loops infinitos)
  AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(5),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  // Opcional — usado en futuras integraciones con Google Cloud
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    '❌ Variables de entorno inválidas o faltantes:\n',
    result.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env: Env = result.data;
