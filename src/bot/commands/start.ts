import type { Context } from 'grammy';
import { escapeTelegramMarkdown } from '../../utils/telegramMarkdown.js';

export async function startHandler(ctx: Context): Promise<void> {
  const name = escapeTelegramMarkdown(ctx.from?.first_name ?? 'equipo');

  await ctx.reply(
    `👋 Hola *${name}*, soy *PresalesTeam* — tu equipo de agentes de IA para ventas B2B.\n\n` +
    `Analizo empresas prospecto y redacto mensajes de outreach personalizados listos para enviar.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*🚀 SETUP INICIAL (una sola vez)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Antes de tu primer análisis, configurá el perfil de tu empresa:\n` +
    `→ /perfil\n\n` +
    `Esto le da contexto al agente sobre tus servicios, clientes y propuesta de valor para que el outreach sea relevante.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*🎯 CÓMO ANALIZAR UN PROSPECTO*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Escribí el nombre de una empresa (o /analyze) y el bot te va a preguntar:\n\n` +
    `1️⃣ *Nombre de la empresa* — el prospecto a analizar\n` +
    `2️⃣ *Website* — su página web _(opcional, escribí \`-\` para saltear)_\n` +
    `3️⃣ *LinkedIn del contacto* — la persona con quien hablás _(opcional, \`skip\` para saltear)_\n` +
    `4️⃣ *Tema de contacto* — ¿por qué nos contactaron o por qué los contactamos?\n` +
    `5️⃣ *Mensaje del prospecto* — si te escribieron algo, pegalo acá _(opcional)_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*📋 QUÉ RECIBÍS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 *Análisis* — industria, contexto y puntos de dolor del prospecto\n` +
    `✉️ *Mensaje de outreach* — listo para copiar y enviar\n` +
    `💡 *Notas de personalización* — sugerencias para afinar el enfoque\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*⌨️ COMANDOS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `/analyze — Iniciar análisis de prospecto\n` +
    `/leads — Buscar y calificar potenciales clientes\n` +
    `/perfil — Ver o actualizar el perfil de tu empresa\n` +
    `/cancelar — Cancelar el análisis actual\n` +
    `/help — Ver esta ayuda de nuevo\n\n` +
    `_¡Empezá escribiendo el nombre de tu primer prospecto!_ 👇`,
    { parse_mode: 'Markdown' },
  );
}
