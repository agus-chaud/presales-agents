// Herramienta demo: retorna la fecha y hora actual.
// Es la herramienta fundacional — demuestra que el tool registry funciona
// y que el agent loop puede ejecutar herramientas correctamente.
// ESCALABILIDAD: Para añadir web search, LinkedIn scraping, ElevenLabs TTS,
// crear un archivo similar en este directorio y registrarlo en index.ts.
import type { Tool } from '../types.js';

export const getCurrentTimeTool: Tool = {
  schema: {
    name: 'get_current_time',
    description:
      'Retorna la fecha y hora actual. Útil para contextualizar análisis de mercado y mensajes de outreach.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description:
            'Nombre de timezone IANA (ej: "America/Buenos_Aires", "Europe/Madrid"). Por defecto UTC.',
        },
      },
      required: [],
    },
  },

  async execute(args): Promise<{ success: true; data: { datetime: string; timezone: string } }> {
    const tz =
      typeof args['timezone'] === 'string' ? args['timezone'] : 'UTC';

    try {
      const now = new Date().toLocaleString('es-AR', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return {
        success: true,
        data: { datetime: now, timezone: tz },
      };
    } catch {
      // Timezone inválida — fallback a UTC
      const now = new Date().toISOString();
      return {
        success: true,
        data: { datetime: now, timezone: 'UTC' },
      };
    }
  },
};
