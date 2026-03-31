// SEGURIDAD: Whitelist enforcement.
// Se ejecuta ANTES que cualquier otra lógica — si el user_id no está en la whitelist,
// el update se descarta silenciosamente (sin responder al atacante).
// DECISIÓN: Drop silencioso en vez de "no autorizado" para no confirmar que el bot existe.
import type { MiddlewareFn, Context } from 'grammy';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export const authMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || !env.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    logger.warn('Acceso bloqueado: usuario no autorizado', { userId });
    return; // Drop silencioso — NO llamar next()
  }

  await next();
};
