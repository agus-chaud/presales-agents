import type { Context } from 'grammy';

export async function helpHandler(ctx: Context): Promise<void> {
  await ctx.reply(
    `*PresalesTeam — Ayuda*\n\n` +
    `*Comandos:*\n` +
    `/analyze — Iniciar análisis de prospecto\n` +
    `/leads — Buscar y calificar potenciales clientes\n` +
    `/perfil — Ver o actualizar el perfil de tu empresa\n` +
    `/cancelar — Cancelar el análisis en curso\n` +
    `/start — Ver las instrucciones completas\n` +
    `/help — Este mensaje\n\n` +
    `*Flujo de análisis:*\n` +
    `1️⃣ Nombre de la empresa prospecto\n` +
    `2️⃣ Website _(escribí \`-\` para saltear)_\n` +
    `3️⃣ LinkedIn del contacto _(escribí \`skip\` para saltear)_\n` +
    `4️⃣ Tema de contacto\n` +
    `5️⃣ Mensaje del prospecto _(escribí \`skip\` para saltear)_\n\n` +
    `_Para instrucciones detalladas usá /start_`,
    { parse_mode: 'Markdown' },
  );
}
