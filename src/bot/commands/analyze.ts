// Handler principal con wizard de intake del prospecto.
// Flujo: empresa → web → LinkedIn (opcional) → tema → mensaje (opcional) → análisis.
// El agente recibe los datos del prospecto ya estructurados para generar el outreach.

import type { Context } from 'grammy';
import { sanitizeInput } from '../../utils/sanitize.js';
import { logger } from '../../utils/logger.js';
import { sessionRepo } from '../../db/repositories/sessionRepo.js';
import { messageRepo } from '../../db/repositories/messageRepo.js';
import { companyProfileRepo } from '../../db/repositories/companyProfileRepo.js';
import { wizardManager } from '../wizardManager.js';
import type { WizardState } from '../wizardManager.js';
import { runAgentLoop } from '../../agent/agentLoop.js';
import { enqueueAgent, isAgentBusy } from '../agentQueue.js';
import { escapeTelegramMarkdown } from '../../utils/telegramMarkdown.js';

const SKIP_KEYWORDS = ['skip', '-', 'no', 'n/a', 'ninguno', 'ninguna'];

function isSkip(text: string): boolean {
  return SKIP_KEYWORDS.includes(text.trim().toLowerCase());
}

export async function analyzeHandler(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const rawText = ctx.message?.text ?? ctx.message?.caption ?? '';
  const text = sanitizeInput(rawText.replace(/^\/(analyze|cancelar)\s*/i, '').trim());

  // Comando /cancelar: resetea el wizard
  if (rawText.startsWith('/cancelar')) {
    await wizardManager.resetIntake(userId);
    await ctx.reply(
      '🔄 Wizard cancelado. Podés empezar de nuevo enviando cualquier mensaje.',
    );
    return;
  }

  const state = await wizardManager.get(userId);

  // ──────────────────────────────────────────────
  // PASO 0: inicio de nuevo wizard (estado idle)
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'idle') {
    await wizardManager.update(userId, { intakeStep: 'awaiting_company' });
    await ctx.reply(
      '🎯 *Nuevo análisis de prospecto*\n\n' +
      'Voy a hacerte algunas preguntas para recopilar info del prospecto y generar el mejor mensaje de outreach.\n\n' +
      '*¿Cuál es el nombre de la empresa que querés analizar?*\n\n' +
      '_Tip: Podés cancelar en cualquier momento con /cancelar_',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  if (!text) return;

  // ──────────────────────────────────────────────
  // PASO 1: nombre de la empresa
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'awaiting_company') {
    const safeText = escapeTelegramMarkdown(text);
    await wizardManager.update(userId, {
      intakeStep: 'awaiting_website',
      companyName: text,
    });
    await ctx.reply(
      `✅ *${safeText}* — anotado.\n\n` +
      `🌐 *¿Cuál es el link de su página web?*\n\n` +
      `_Ejemplo: acmecorp.com_`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ──────────────────────────────────────────────
  // PASO 2: website
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'awaiting_website') {
    await wizardManager.update(userId, {
      intakeStep: 'awaiting_linkedin',
      website: isSkip(text) ? undefined : text,
    });
    await ctx.reply(
      `✅ Website guardado.\n\n` +
      `👤 *¿Cuál es el LinkedIn de la persona que los contactó?*\n\n` +
      `_Opcional — podés responder "skip" para omitirlo_`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ──────────────────────────────────────────────
  // PASO 3: LinkedIn (opcional)
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'awaiting_linkedin') {
    const linkedin = isSkip(text) ? undefined : text;
    await wizardManager.update(userId, {
      intakeStep: 'awaiting_topic',
      linkedin,
    });
    const linkedinMsg = linkedin
      ? `✅ LinkedIn: ${escapeTelegramMarkdown(linkedin)}`
      : `⏭️ LinkedIn omitido.`;
    await ctx.reply(
      `${linkedinMsg}\n\n` +
      `📌 *¿Cuál es el tema por el que los contactaron?*\n\n` +
      `_Ejemplo: "automatización de procesos", "integración con ERP", "reducción de costos"_`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ──────────────────────────────────────────────
  // PASO 4: tema del contacto
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'awaiting_topic') {
    const safeTopic = escapeTelegramMarkdown(text);
    await wizardManager.update(userId, {
      intakeStep: 'awaiting_message',
      topic: text,
    });
    await ctx.reply(
      `✅ Tema: *${safeTopic}*\n\n` +
      `💬 *¿Qué mensaje te mandaron?*\n\n` +
      `_Copiá y pegá el mensaje original del prospecto. Podés responder "skip" si no lo tenés._`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ──────────────────────────────────────────────
  // PASO 5: mensaje del prospecto (opcional) → ANÁLISIS
  // ──────────────────────────────────────────────
  if (state.intakeStep === 'awaiting_message') {
    const prospectMessage = isSkip(text) ? undefined : text;
    const updatedState = await wizardManager.update(userId, {
      intakeStep: 'ready',
      prospectMessage,
    });

    // Bloquear si ya hay un análisis activo para este usuario
    if (isAgentBusy(userId)) {
      await ctx.reply(
        '⏳ *Ya hay un análisis en curso.* Esperá a que termine antes de iniciar otro.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    // Mensaje de feedback inmediato
    const thinkingMsg = await ctx.reply(
      '🔍 *Analizando la empresa y generando el mensaje de outreach...*\n' +
      '_Esto puede tomar unos segundos._',
      { parse_mode: 'Markdown' },
    );

    try {
      // Cargar perfil de IQ4b para contexto
      const iq4bProfile = await companyProfileRepo.get();

      // Obtener o crear sesión y cargar historial
      const session = await sessionRepo.getOrCreate(userId);
      const history = await messageRepo.getBySession(session.id);

      // Construir el mensaje del usuario con todos los datos del prospecto
      const userMessage = buildProspectMessage(updatedState);

      // Persistir el mensaje del usuario
      await messageRepo.insert({ sessionId: session.id, role: 'user', content: userMessage });

      logger.info('Iniciando análisis de prospecto', {
        userId,
        sessionId: session.id,
        companyName: updatedState.companyName,
        hasProfile: !!iq4bProfile,
      });

      // Correr el agent loop con perfil de IQ4b como contexto
      const result = await enqueueAgent(userId, () => runAgentLoop({
        userId,
        userMessage,
        history,
        iq4bProfile: iq4bProfile ?? undefined,
      }));

      // Persistir la respuesta del agente
      await messageRepo.insert({
        sessionId: session.id,
        role: 'assistant',
        content: result.finalAnswer,
      });

      // Resetear wizard para el siguiente prospecto
      await wizardManager.resetIntake(userId);

      const suffix = result.abortedByLimit
        ? '\n\n⚠️ Análisis parcial — enviá /analyze para intentar de nuevo.'
        : '\n\nPodés enviar cualquier mensaje para analizar otro prospecto.';

      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        result.finalAnswer + suffix,
      );
    } catch (err) {
      logger.error('Error en analyzeHandler', { userId, error: String(err) });
      // Resetear wizard en caso de error para no dejar al usuario bloqueado
      await wizardManager.resetIntake(userId);

      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          thinkingMsg.message_id,
          '❌ Ocurrió un error inesperado. Por favor, enviá cualquier mensaje para intentar de nuevo.',
        )
        .catch(() => void ctx.reply('❌ Ocurrió un error inesperado. Intentá de nuevo.'));
    }
    return;
  }

  // Estado 'ready' u otro: resetear e iniciar de nuevo
  await wizardManager.resetIntake(userId);
  await ctx.reply(
    '🔄 Iniciando nuevo análisis.\n\n*¿Cuál es el nombre de la empresa que querés analizar?*',
    { parse_mode: 'Markdown' },
  );
  await wizardManager.update(userId, { intakeStep: 'awaiting_company' });
}

/**
 * Convierte los datos del wizard en un mensaje estructurado para el agente.
 */
function buildProspectMessage(state: WizardState): string {
  const parts: string[] = [
    `## Análisis de Prospecto`,
    ``,
    `**Empresa**: ${state.companyName ?? 'No especificado'}`,
  ];

  if (state.website) {
    parts.push(`**Website**: ${state.website}`);
  }
  if (state.linkedin) {
    parts.push(`**LinkedIn del contacto**: ${state.linkedin}`);
  }
  if (state.topic) {
    parts.push(`**Tema de contacto**: ${state.topic}`);
  }
  if (state.prospectMessage) {
    parts.push(``, `**Mensaje original del prospecto**:`, `"${state.prospectMessage}"`);
  }

  parts.push(
    ``,
    `Por favor:`,
    `1. Investigá la empresa (usando el website si está disponible)`,
    `2. Identificá sus puntos de dolor y necesidades principales`,
    `3. Redactá un primer mensaje de outreach personalizado que conecte sus puntos de dolor con la propuesta de valor de IQ4b`,
    `4. El mensaje debe sonar humano, directo y relevante para el contexto en el que nos contactaron`,
  );

  return parts.join('\n');
}
