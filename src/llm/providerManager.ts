// Orquesta el failover entre todos los modelos LLM disponibles (Groq + OpenRouter).
// Estrategia: lista plana ordenada por calidad. Si un modelo falla por rate limit (429),
// lee el header Retry-After y reintenta. Si falla por otro motivo, pasa al siguiente.
// Solo lanza error si TODOS los modelos fallan.
import { logger } from '../utils/logger.js';
import { GroqProvider } from './groqProvider.js';
import { OpenRouterProvider } from './openRouterProvider.js';
import type { LLMProvider, LLMResponse, Message, ToolDefinition } from './types.js';

const MAX_RETRIES_ON_RATE_LIMIT = 2;

// ── Modelos disponibles ───────────────────────────────────────────────────────
// Groq primero (más rápido). OpenRouter como red de seguridad.
// Orden: mejor calidad → más liviano dentro de cada provider.
const ALL_PROVIDERS: LLMProvider[] = [
  // Groq — free tier
  new GroqProvider('llama-3.3-70b-versatile'),
  new GroqProvider('llama-3.1-8b-instant'),
  new GroqProvider('gemma2-9b-it'),
  new GroqProvider('llama3-8b-8192'),

  // OpenRouter — free tier (:free = sin costo, mayor latencia)
  new OpenRouterProvider('meta-llama/llama-3.3-70b-instruct:free'),
  new OpenRouterProvider('mistralai/mistral-7b-instruct:free'),
  new OpenRouterProvider('google/gemma-2-9b-it:free'),
  new OpenRouterProvider('microsoft/phi-3-mini-128k-instruct:free'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 429;
  }
  return String(err).includes('429') || String(err).toLowerCase().includes('rate limit');
}

/** Lee el header Retry-After del error si existe; si no, devuelve el default. */
function getRetryAfterMs(err: unknown, defaultMs: number): number {
  if (err && typeof err === 'object' && 'headers' in err) {
    const headers = (err as { headers: Record<string, string> }).headers;
    const raw = headers?.['retry-after'];
    if (raw) {
      const seconds = parseFloat(raw);
      if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 500; // +500ms buffer
    }
  }
  return defaultMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── ProviderManager ───────────────────────────────────────────────────────────

class ProviderManager implements LLMProvider {
  readonly name = 'provider-manager';

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    let lastError: unknown;

    for (const provider of ALL_PROVIDERS) {
      for (let attempt = 0; attempt <= MAX_RETRIES_ON_RATE_LIMIT; attempt++) {
        try {
          const result = await provider.chat(messages, tools);
          if (attempt > 0 || provider !== ALL_PROVIDERS[0]) {
            logger.info(`LLM respondió OK`, { provider: provider.name, attempt });
          }
          return result;
        } catch (err) {
          lastError = err;

          if (isRateLimitError(err) && attempt < MAX_RETRIES_ON_RATE_LIMIT) {
            const waitMs = getRetryAfterMs(err, (attempt + 1) * 3_000);
            logger.warn(`Rate limit en "${provider.name}" — reintentando en ${waitMs}ms`, {
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES_ON_RATE_LIMIT,
            });
            await sleep(waitMs);
            continue; // reintentar mismo modelo
          }

          // Error no recuperable o reintentos agotados → siguiente modelo
          logger.warn(`Modelo "${provider.name}" falló, probando siguiente`, {
            error: String(err).slice(0, 120),
            isRateLimit: isRateLimitError(err),
          });
          break;
        }
      }
    }

    throw new Error(
      `Todos los modelos LLM fallaron. Último error: ${String(lastError)}`,
    );
  }
}

// Singleton exportado — el resto del código solo importa esto.
// DECISIÓN DEC-002: Nadie más importa GroqProvider u OpenRouterProvider.
export const providerManager = new ProviderManager();
