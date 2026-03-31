// Comando /leads: activa el agente de prospección de leads.
// El usuario describe qué tipo de empresas busca → el agente sale a buscarlas
// en la web, las califica contra el perfil de IQ4b, y devuelve una lista rankeada.
// Los leads se guardan automáticamente en Firestore con status 'new'.

import type { Context } from 'grammy';
import { sanitizeInput } from '../../utils/sanitize.js';
import { logger } from '../../utils/logger.js';
import { companyProfileRepo } from '../../db/repositories/companyProfileRepo.js';
import { leadsRepo } from '../../db/repositories/leadsRepo.js';
import { wizardManager } from '../wizardManager.js';
import { runAgentLoop } from '../../agent/agentLoop.js';
import { buildLeadsSystemPrompt } from '../../agent/leadsPrompt.js';
import { enqueueAgent, isAgentBusy } from '../agentQueue.js';
import type { LeadsAgentOutput } from '../../agent/leadsPrompt.js';
import { escapeTelegramMarkdown } from '../../utils/telegramMarkdown.js';

// Límite de chars por mensaje de Telegram
const TELEGRAM_MAX_CHARS = 3800;

export async function leadsHandler(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  // Reply primero — no bloqueamos al usuario esperando Firestore
  await ctx.reply(
    `🔍 *Agente de Prospección de Leads*\n\n` +
    `Describí qué tipo de empresas querés encontrar.\n\n` +
    `*Ejemplos:*\n` +
    `• "Distribuidoras mayoristas en Argentina con mucho stock"\n` +
    `• "Empresas de logística en LATAM que usan SAP"\n` +
    `• "PyMEs de retail en Buenos Aires que crecieron en el último año"\n\n` +
    `_Podés cancelar con /cancelar_`,
    { parse_mode: 'Markdown' },
  );

  await wizardManager.update(userId, { leadsStep: 'awaiting_context' });
}

export async function leadsWizardHandler(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const rawText = ctx.message?.text ?? '';
  const searchContext = sanitizeInput(rawText.trim());

  if (!searchContext) return;

  // Si ya hay un agentLoop activo para este usuario, avisarle en lugar de encolar silenciosamente
  if (isAgentBusy(userId)) {
    await ctx.reply(
      '⏳ *Ya hay una búsqueda en curso.* Esperá a que termine antes de iniciar otra.',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // Mensaje de feedback inmediato
  const thinkingMsg = await ctx.reply(
    '🔍 *Buscando leads...*\n' +
    '_El agente está buscando en la web y analizando empresas. Puede tomar 30-60 segundos._',
    { parse_mode: 'Markdown' },
  );

  // Resetear el wizard de leads
  await wizardManager.update(userId, { leadsStep: 'idle' });

  try {
    // Cargar perfil de IQ4b para el prompt del agente
    const iq4bProfile = await companyProfileRepo.get();

    logger.info('Iniciando búsqueda de leads', { userId, searchContext });

    const result = await enqueueAgent(userId, () => runAgentLoop({
      userId,
      userMessage: `Buscá empresas que matcheen con este contexto: ${searchContext}`,
      history: [],
      iq4bProfile: iq4bProfile ?? undefined,
      systemPrompt: buildLeadsSystemPrompt(iq4bProfile ?? undefined),
    }));

    logger.info('Búsqueda de leads completada', {
      userId,
      iterations: result.iterationsUsed,
      tools: result.toolCallsMade,
      aborted: result.abortedByLimit,
    });

    // Intentar parsear la respuesta como JSON estructurado
    const parsed = tryParseLeadsOutput(result.finalAnswer);

    if (parsed && parsed.leads.length > 0) {
      // Guardar leads en Firestore
      await leadsRepo.saveMany(
        parsed.leads.map((lead) => ({
          ...lead,
          search_query: searchContext,
          status: 'new' as const,
        })),
      );

      // Formatear y enviar respuesta
      const messages = formatLeadsForTelegram(parsed, searchContext);

      // Editar el mensaje de "pensando" con el primer fragmento
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        messages[0]!,
        { parse_mode: 'Markdown' },
      );

      // Enviar fragmentos adicionales si la respuesta es larga
      for (let i = 1; i < messages.length; i++) {
        await ctx.reply(messages[i]!, { parse_mode: 'Markdown' });
      }

      // Mensaje de cierre
      await ctx.reply(
        `_Leads guardados. Usá /analyze [empresa] para hacer un análisis profundo de cualquiera de ellas._`,
        { parse_mode: 'Markdown' },
      );
    } else {
      // Fallback: mostrar la respuesta raw si no se pudo parsear JSON
      const displayText = result.finalAnswer.length > TELEGRAM_MAX_CHARS
        ? result.finalAnswer.slice(0, TELEGRAM_MAX_CHARS) + '\n\n[... respuesta truncada]'
        : result.finalAnswer;

      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        displayText || '❌ El agente no encontró leads para ese criterio. Probá con una búsqueda diferente.',
      );
    }
  } catch (err) {
    logger.error('Error en leadsWizardHandler', { userId, error: String(err) });
    await ctx.api
      .editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        '❌ Ocurrió un error al buscar leads. Intentá de nuevo con /leads.',
      )
      .catch(() => void ctx.reply('❌ Ocurrió un error al buscar leads. Intentá de nuevo con /leads.'));
  }
}

/**
 * Intenta parsear la respuesta del agente como JSON estructurado de leads.
 * Retorna null si falla (respuesta inesperada del LLM).
 */
function tryParseLeadsOutput(text: string): LeadsAgentOutput | null {
  try {
    // El LLM a veces envuelve el JSON en bloques de código aunque le pedimos que no
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    const parsed = JSON.parse(cleaned) as LeadsAgentOutput;

    if (!Array.isArray(parsed.leads)) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Formatea la lista de leads en mensajes de Telegram con Markdown.
 * Divide en múltiples mensajes si supera el límite de chars.
 */
function formatLeadsForTelegram(output: LeadsAgentOutput, searchQuery: string): string[] {
  const safeSearchQuery = escapeTelegramMarkdown(searchQuery);
  const safeSummary = escapeTelegramMarkdown(output.summary);
  const lines: string[] = [
    `🔍 *Leads encontrados para: "${safeSearchQuery}"*\n`,
    `_${safeSummary}_\n`,
    `━━━━━━━━━━━━━━━━━━━━\n`,
  ];

  const leadBlocks: string[] = output.leads.map((lead, i) => {
    const scoreEmoji = lead.fit_score >= 8 ? '🟢' : lead.fit_score >= 6 ? '🟡' : '🟠';
    const safeLeadName = escapeTelegramMarkdown(lead.name);
    const safeIndustry = lead.industry ? escapeTelegramMarkdown(lead.industry) : '';
    const safeWhyFit = escapeTelegramMarkdown(lead.why_fit);
    const signals = lead.fit_signals
      .map((s) => `  • ${escapeTelegramMarkdown(s)}`)
      .join('\n');
    const websiteLine = lead.website ? `\n🌐 ${escapeTelegramMarkdown(lead.website)}` : '';
    const industryLine = safeIndustry ? ` _(${safeIndustry})_` : '';

    return [
      `${scoreEmoji} *${i + 1}. ${safeLeadName}*${industryLine}`,
      `Score: ${lead.fit_score}/10`,
      websiteLine,
      `💡 ${safeWhyFit}`,
      signals ? `\nSeñales detectadas:\n${signals}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  // Dividir en mensajes de ≤ TELEGRAM_MAX_CHARS
  const messages: string[] = [];
  let current = lines.join('\n');

  for (const block of leadBlocks) {
    const candidate = current + '\n\n' + block + '\n━━━━━━━━━━━━━━━━━━━━';
    if (candidate.length > TELEGRAM_MAX_CHARS && current.length > 0) {
      messages.push(current);
      current = block + '\n━━━━━━━━━━━━━━━━━━━━';
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    messages.push(current);
  }

  return messages.length > 0 ? messages : ['No se encontraron leads para ese criterio.'];
}
