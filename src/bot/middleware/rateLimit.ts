// Rate limiting por usuario: token bucket en memoria.
// Previene abuso de burst (ej: 100 mensajes rápidos que consuman todos los tokens del LLM).
// ESCALABILIDAD: Para multi-instancia en cloud, reemplazar el Map por Redis.
import type { MiddlewareFn, Context } from 'grammy';
import { logger } from '../../utils/logger.js';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const MAX_TOKENS = 5;          // máximo de mensajes en burst
const REFILL_RATE_MS = 60_000; // refill completo cada 60 segundos
const buckets = new Map<number, Bucket>();

function getBucket(userId: number): Bucket {
  const now = Date.now();
  const existing = buckets.get(userId);

  if (!existing) {
    const bucket = { tokens: MAX_TOKENS - 1, lastRefill: now };
    buckets.set(userId, bucket);
    return bucket;
  }

  // Refill proporcional al tiempo transcurrido
  const elapsed = now - existing.lastRefill;
  if (elapsed >= REFILL_RATE_MS) {
    existing.tokens = MAX_TOKENS;
    existing.lastRefill = now;
  }

  return existing;
}

export const rateLimitMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const bucket = getBucket(userId);

  if (bucket.tokens <= 0) {
    logger.warn('Rate limit aplicado', { userId });
    await ctx.reply(
      '⏱ Demasiadas solicitudes. Espera un momento antes de enviar otra.',
    );
    return;
  }

  bucket.tokens--;
  await next();
};
