// Entry point de PresalesTeam.
// Orden de inicialización:
// 1. env (valida credenciales — falla rápido si algo falta)
// 2. DB (crea tablas si no existen)
// 3. Tools (registra herramientas disponibles)
// 4. Bot (inicia long polling)
//
// ESCALABILIDAD: Para cloud deployment, reemplazar bot.start()
// con un servidor HTTP + webhookCallback(bot, 'express').
import { env } from './config/env.js';
import { initDatabase } from './db/database.js';
import { toolRegistry } from './tools/registry.js';
import { getCurrentTimeTool } from './tools/implementations/getCurrentTime.js';
import { webSearchTool } from './tools/implementations/webSearch.js';
import { fetchWebpageTool } from './tools/implementations/fetchWebpage.js';
import { bot } from './bot/bot.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Iniciando PresalesTeam...', {
    nodeEnv: env.NODE_ENV,
    dbPath: env.DB_PATH,
    allowedUsers: env.TELEGRAM_ALLOWED_USER_IDS.length,
  });

  // 1. Inicializar bases de datos (SQLite local + Firestore opcional)
  initDatabase();
  if (env.FIREBASE_PROJECT_ID) {
    const { initFirestore } = await import('./db/firestore.js');
    initFirestore();
    logger.info('Firestore habilitado para copia en la nube');
  }

  // 2. Registrar herramientas del agente
  // Para añadir una nueva herramienta: importarla y registrarla aquí.
  toolRegistry.register(getCurrentTimeTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(fetchWebpageTool);

  logger.info('Herramientas registradas', {
    tools: toolRegistry.listNames(),
  });

  // 3. Iniciar bot (long polling — bloqueante)
  logger.info('Bot iniciando (long polling)...');
  await bot.start({
    onStart: (info) => {
      logger.info(`✅ Bot activo: @${info.username}`, {
        botId: info.id,
        allowedUsers: env.TELEGRAM_ALLOWED_USER_IDS,
      });
    },
  });
}

// Manejo de señales del sistema para shutdown limpio
process.on('SIGINT', () => {
  logger.info('Recibido SIGINT — cerrando bot...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Recibido SIGTERM — cerrando bot...');
  bot.stop();
  process.exit(0);
});

main().catch((err) => {
  logger.error('Error fatal al iniciar PresalesTeam', { error: String(err) });
  process.exit(1);
});
