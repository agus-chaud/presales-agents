// Instancia grammy Bot y configura la cadena de middleware.
// DECISIÓN DEC-004: Long polling con bot.start() — cero configuración para local.
// Para cloud deployment: reemplazar bot.start() por webhookCallback(bot, 'express').
//
// Cadena de middleware (orden crítico):
// 1. auth → bloquea no-whitelist antes de cualquier procesamiento
// 2. rateLimit → previene abuso de usuarios autorizados
// 3. commands → routing a handlers específicos
// 4. catch-all → texto libre enrutado según estado del wizard
import { Bot } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { startHandler } from './commands/start.js';
import { helpHandler } from './commands/help.js';
import { analyzeHandler } from './commands/analyze.js';
import { setupProfileHandler, profileWizardHandler } from './commands/setupProfile.js';
import { leadsHandler, leadsWizardHandler } from './commands/leads.js';
import { wizardManager } from './wizardManager.js';
import type { Context } from 'grammy';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// 1. Autenticación — debe ser el primer middleware
bot.use(authMiddleware);

// 2. Rate limiting — solo para usuarios autorizados
bot.use(rateLimitMiddleware);

// 3. Comandos
bot.command('start', startHandler);
bot.command('help', helpHandler);
bot.command('analyze', analyzeHandler);
bot.command('cancelar', analyzeHandler); // cancelar wizard de intake
bot.command('perfil', setupProfileHandler);
bot.command('leads', leadsHandler);

// 4. Catch-all: enrutar según el estado activo del wizard
bot.on('message:text', async (ctx: Context) => {
  const userId = ctx.from!.id;
  const state = await wizardManager.get(userId);

  // Si el usuario está en el wizard de perfil IQ4b → profileWizardHandler
  if (
    state.profileStep !== 'idle' &&
    state.profileStep !== 'done'
  ) {
    return profileWizardHandler(ctx);
  }

  // Si el usuario está en el wizard de leads → leadsWizardHandler
  // IMPORTANTE: este check va antes del perfil confirm para evitar que un estado
  // residual de perfil (__confirm_update__) capture mensajes destinados a leads.
  if (state.leadsStep === 'awaiting_context') {
    return leadsWizardHandler(ctx);
  }

  // Caso especial: esperando confirmación de actualización de perfil
  if (state.profileStep === 'idle' && state.profileData?.nombre === '__confirm_update__') {
    return profileWizardHandler(ctx);
  }

  // Resto: wizard de intake del prospecto o inicio de nuevo wizard
  return analyzeHandler(ctx);
});

// Handler global de errores — nunca crashear el proceso por un error en un handler
bot.catch((err) => {
  const userId = err.ctx.from?.id;
  logger.error('Error no manejado en el bot', {
    userId,
    error: String(err.error),
  });

  // Intentar notificar al usuario (puede fallar si el error es de red)
  err.ctx
    .reply('❌ Error interno. El equipo está trabajando en ello.')
    .catch(() => {});
});
