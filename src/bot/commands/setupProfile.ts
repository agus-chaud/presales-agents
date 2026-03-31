// Comando /perfil: configura el perfil de IQ4b (tu empresa) una sola vez.
// El perfil se guarda de forma global en Firestore y se usa como contexto del agente en cada análisis.
// Si ya existe, lo muestra y ofrece actualizarlo.

import type { Context } from 'grammy';
import { sanitizeInput } from '../../utils/sanitize.js';
import { logger } from '../../utils/logger.js';
import { companyProfileRepo } from '../../db/repositories/companyProfileRepo.js';
import type { IQ4bProfile } from '../../db/repositories/companyProfileRepo.js';
import { wizardManager } from '../wizardManager.js';
import { escapeTelegramMarkdown } from '../../utils/telegramMarkdown.js';

export async function setupProfileHandler(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  const existing = await companyProfileRepo.get();

  if (existing) {
    // Mostrar el perfil guardado
    const profileText = formatProfile(existing);
    await ctx.reply(
      `📋 *Perfil de IQ4b guardado*\n\n${profileText}\n\n` +
      `¿Querés actualizarlo? Respondé *"sí"* para editar o *"no"* para cancelar.`,
      { parse_mode: 'Markdown' },
    );

    // Marcar que está esperando confirmación de actualización
    await wizardManager.update(userId, { profileStep: 'awaiting_nombre' });
    // Usar un flag especial para saber que estamos en modo confirmación
    await wizardManager.update(userId, {
      profileStep: 'idle',
      profileData: { nombre: '__confirm_update__' },
    });
    return;
  }

  // No existe perfil → iniciar wizard
  await startProfileWizard(ctx, userId);
}

async function startProfileWizard(ctx: Context, userId: number): Promise<void> {
  await wizardManager.update(userId, {
    profileStep: 'awaiting_nombre',
    profileData: {},
  });
  await ctx.reply(
    `🏢 *Configuración del perfil de IQ4b*\n\n` +
    `Voy a hacerte 10 preguntas sobre tu empresa para usarlas como contexto en cada análisis.\n` +
    `Solo necesitás hacerlo *una vez*. Podés pegar textos largos en cada respuesta.\n\n` +
    `1️⃣ *¿Cuál es el nombre completo de tu empresa?*\n\n` +
    `_Ejemplo: IQ4b, IQ4b Technologies, etc._`,
    { parse_mode: 'Markdown' },
  );
}

export async function profileWizardHandler(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const rawText = ctx.message?.text ?? '';
  const text = sanitizeInput(rawText.trim());

  if (!text) return;

  const state = await wizardManager.get(userId);

  // ── Confirmación de actualización ──
  if (state.profileStep === 'idle' && state.profileData?.nombre === '__confirm_update__') {
    const answer = text.toLowerCase();
    if (answer === 'sí' || answer === 'si' || answer === 'yes') {
      await startProfileWizard(ctx, userId);
    } else {
      await wizardManager.update(userId, { profileData: undefined });
      await ctx.reply('✅ Perfil sin cambios.');
    }
    return;
  }

  // ── Paso 1: nombre ──
  if (state.profileStep === 'awaiting_nombre') {
    const safeText = escapeTelegramMarkdown(text);
    await wizardManager.update(userId, {
      profileStep: 'awaiting_descripcion',
      profileData: { ...state.profileData, nombre: text },
    });
    await ctx.reply(
      `✅ *${safeText}*\n\n` +
      `2️⃣ *¿Cuál es la descripción y propuesta de valor de IQ4b?*\n\n` +
      `_Contá qué hace IQ4b y qué problema principal resuelve._`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 2: descripción ──
  if (state.profileStep === 'awaiting_descripcion') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_propuesta',
      profileData: { ...state.profileData, descripcion: text },
    });
    await ctx.reply(
      `✅ Descripción guardada.\n\n` +
      `3️⃣ *¿Cuál es la propuesta de valor diferencial de IQ4b?*\n\n` +
      `_¿Por qué elegiría alguien IQ4b sobre otras opciones?_`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 3: propuesta de valor ──
  if (state.profileStep === 'awaiting_propuesta') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_clientes',
      profileData: { ...state.profileData, propuesta_de_valor: text },
    });
    await ctx.reply(
      `✅ Propuesta de valor guardada.\n\n` +
      `4️⃣ *¿Cuáles son los clientes ideales de IQ4b?*\n\n` +
      `_Industria, tamaño de empresa, rol del decisor, etc._`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 4: clientes ideales ──
  if (state.profileStep === 'awaiting_clientes') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_casos',
      profileData: { ...state.profileData, clientes_ideales: text },
    });
    await ctx.reply(
      `✅ Perfil de cliente ideal guardado.\n\n` +
      `5️⃣ *¿Tenés casos de éxito o resultados concretos que destacar?*\n\n` +
      `_Ej: "Reducimos 40% los costos de X en empresa Y"_`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 5: casos de éxito ──
  if (state.profileStep === 'awaiting_casos') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_diferenciadores',
      profileData: { ...state.profileData, casos_de_exito: text },
    });
    await ctx.reply(
      `✅ Casos de éxito guardados.\n\n` +
      `6️⃣ *¿Cuáles son los diferenciadores clave de IQ4b?*\n\n` +
      `_Tecnología, precio, velocidad de implementación, equipo, metodología, etc._`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 6: diferenciadores → continuar con campos extendidos ──
  if (state.profileStep === 'awaiting_diferenciadores') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_servicios',
      profileData: { ...state.profileData, diferenciadores: text },
    });
    await ctx.reply(
      `✅ Diferenciadores guardados.\n\n` +
      `7️⃣ *¿Qué servicios específicos ofrece IQ4b?*\n\n` +
      `_Ej: implementación Qlik Sense, Qlik Cloud, NPrinting, capacitación, soporte, paquetes de horas mensuales..._\n\n` +
      `Podés pegar una lista completa.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 7: servicios ──
  if (state.profileStep === 'awaiting_servicios') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_herramientas',
      profileData: { ...state.profileData, servicios: text },
    });
    await ctx.reply(
      `✅ Servicios guardados.\n\n` +
      `8️⃣ *¿Qué herramientas y módulos de Qlik manejan?*\n\n` +
      `_Ej: Qlik Sense Enterprise, Qlik Cloud, QlikView, NPrinting, Alerting, GeoAnalytics, AutoML, Talend..._\n\n` +
      `Incluí también conectores y certificaciones si las tienen.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 8: herramientas Qlik ──
  if (state.profileStep === 'awaiting_herramientas') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_clientes_ref',
      profileData: { ...state.profileData, herramientas_qlik: text },
    });
    await ctx.reply(
      `✅ Herramientas guardadas.\n\n` +
      `9️⃣ *¿Cuáles son los clientes de referencia de IQ4b?*\n\n` +
      `_Listá empresas con las que trabajaron, incluyendo industria si podés._\n` +
      `_Ej: Western Union (finanzas), Correo Argentino (logística), ESET LATAM (tecnología)..._\n\n` +
      `Se usarán como social proof en los mensajes de outreach.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 9: clientes de referencia ──
  if (state.profileStep === 'awaiting_clientes_ref') {
    await wizardManager.update(userId, {
      profileStep: 'awaiting_senales',
      profileData: { ...state.profileData, clientes_referencia: text },
    });
    await ctx.reply(
      `✅ Clientes de referencia guardados.\n\n` +
      `🔟 *¿Qué señales indican que una empresa podría necesitar a IQ4b?*\n\n` +
      `_Ej: usan Excel para reportes, tienen QlikView legacy, acaban de implementar un ERP, datos en silos..._\n\n` +
      `Esto se usará también para el futuro agente de búsqueda de leads.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // ── Paso 10: señales de compra → GUARDAR ──
  if (state.profileStep === 'awaiting_senales') {
    const finalData = {
      ...state.profileData,
      senales_de_compra: text,
    };

    const profile: Omit<IQ4bProfile, 'updated_at'> = {
      nombre: finalData.nombre ?? '',
      descripcion: finalData.descripcion ?? '',
      propuesta_de_valor: finalData.propuesta_de_valor ?? '',
      clientes_ideales: finalData.clientes_ideales ?? '',
      casos_de_exito: finalData.casos_de_exito ?? '',
      diferenciadores: finalData.diferenciadores ?? '',
      servicios: finalData.servicios,
      herramientas_qlik: finalData.herramientas_qlik,
      clientes_referencia: finalData.clientes_referencia,
      senales_de_compra: text,
    };

    try {
      await companyProfileRepo.save(profile);
      await wizardManager.update(userId, { profileStep: 'done', profileData: undefined });

      logger.info('Perfil IQ4b guardado', { userId });

      await ctx.reply(
        `🎉 *¡Perfil de IQ4b guardado exitosamente!*\n\n` +
        `${formatProfile(profile)}\n\n` +
        `Ahora usaré esta información como contexto en cada análisis de prospecto. ` +
        `Podés actualizar el perfil en cualquier momento con /perfil.`,
        { parse_mode: 'Markdown' },
      );
    } catch {
      await ctx.reply(
        '❌ Error guardando el perfil. Intentá de nuevo con /perfil.',
      );
    }

    await wizardManager.update(userId, { profileStep: 'idle', profileData: undefined });
    return;
  }
}

function formatProfile(profile: Partial<IQ4bProfile>): string {
  return [
    profile.nombre ? `🏢 *Empresa*: ${escapeTelegramMarkdown(profile.nombre)}` : null,
    profile.descripcion ? `📝 *Descripción*: ${escapeTelegramMarkdown(profile.descripcion)}` : null,
    profile.propuesta_de_valor
      ? `💡 *Propuesta de valor*: ${escapeTelegramMarkdown(profile.propuesta_de_valor)}`
      : null,
    profile.clientes_ideales
      ? `🎯 *Clientes ideales*: ${escapeTelegramMarkdown(profile.clientes_ideales)}`
      : null,
    profile.casos_de_exito ? `🏆 *Casos de éxito*: ${escapeTelegramMarkdown(profile.casos_de_exito)}` : null,
    profile.diferenciadores
      ? `⚡ *Diferenciadores*: ${escapeTelegramMarkdown(profile.diferenciadores)}`
      : null,
    profile.servicios ? `🔧 *Servicios*: ${escapeTelegramMarkdown(profile.servicios)}` : null,
    profile.herramientas_qlik
      ? `🛠 *Herramientas Qlik*: ${escapeTelegramMarkdown(profile.herramientas_qlik)}`
      : null,
    profile.clientes_referencia
      ? `📋 *Clientes de referencia*: ${escapeTelegramMarkdown(profile.clientes_referencia)}`
      : null,
    profile.senales_de_compra
      ? `🎯 *Señales de compra*: ${escapeTelegramMarkdown(profile.senales_de_compra)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

