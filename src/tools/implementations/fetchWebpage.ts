// Herramienta de lectura de páginas web usando Jina.ai Reader.
// Convierte cualquier URL en texto Markdown limpio, ideal para LLMs.
// Sin API key, completamente gratuito.
// DECISIÓN DEC-011: ver docs/decisiones-tecnicas.md
import { logger } from '../../utils/logger.js';
import type { Tool, ToolResult } from '../types.js';
import { isIP } from 'node:net';

// Limitar el contenido para no exceder el context window del LLM
const MAX_CONTENT_CHARS = 3000;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;

  if (normalized === 'localhost' || normalized.endsWith('.local')) {
    return true;
  }

  const ipType = isIP(normalized);
  if (ipType === 4) {
    const [a, b] = normalized.split('.').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return true;
    }
    const secondOctet = b ?? -1;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && secondOctet === 254) return true;
    if (a === 172 && secondOctet >= 16 && secondOctet <= 31) return true;
    if (a === 192 && secondOctet === 168) return true;
    return false;
  }

  if (ipType === 6) {
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80:')) return true;
  }

  return false;
}

export function normalizeAndValidateUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  const candidate = rawUrl.trim();
  if (!candidate) {
    return { ok: false, error: 'La URL no puede estar vacía.' };
  }

  // Si el usuario ya incluyó esquema, se valida explícitamente.
  const explicitSchemeMatch = candidate.match(/^([a-z][a-z0-9+.-]*):/i);
  if (explicitSchemeMatch && !['http', 'https'].includes(explicitSchemeMatch[1]!.toLowerCase())) {
    return { ok: false, error: 'Solo se permiten URLs con protocolo http o https.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
  } catch {
    return { ok: false, error: `URL inválida: ${rawUrl}` };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { ok: false, error: 'Solo se permiten URLs con protocolo http o https.' };
  }

  if (isPrivateOrLocalHostname(parsedUrl.hostname)) {
    return {
      ok: false,
      error: `Destino no permitido por seguridad: ${parsedUrl.hostname}`,
    };
  }

  return { ok: true, url: parsedUrl };
}

export const fetchWebpageTool: Tool = {
  schema: {
    name: 'fetch_webpage',
    description:
      'Lee el contenido de una página web y lo convierte a texto Markdown limpio. ' +
      'Úsala para analizar el sitio web de una empresa, leer noticias, o extraer información de una URL específica. ' +
      'Devuelve el contenido de la página listo para analizar.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'La URL completa de la página a leer. Ejemplo: https://empresa.com/about',
        },
      },
      required: ['url'],
    },
  },

  async execute(args): Promise<ToolResult> {
    const url = typeof args['url'] === 'string' ? args['url'].trim() : '';
    const validation = normalizeAndValidateUrl(url);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    const parsedUrl = validation.url;

    const jinaUrl = `https://r.jina.ai/${parsedUrl.toString()}`;

    try {
      logger.debug('fetch_webpage: leyendo URL via Jina.ai', { url: parsedUrl.toString() });

      const response = await fetch(jinaUrl, {
        headers: {
          Accept: 'text/markdown',
          // Header de cortesía para Jina.ai
          'X-With-Generated-Alt': 'true',
        },
        signal: AbortSignal.timeout(15_000), // 15 segundos máximo
      });

      if (!response.ok) {
        return {
          success: false,
          error: `No se pudo leer la página (HTTP ${response.status}). URL: ${parsedUrl.toString()}`,
        };
      }

      const content = await response.text();

      // Truncar para no saturar el context window
      const truncated = content.length > MAX_CONTENT_CHARS
        ? content.slice(0, MAX_CONTENT_CHARS) + '\n\n[... contenido truncado ...]'
        : content;

      return {
        success: true,
        data: {
          url: parsedUrl.toString(),
          content: truncated,
          truncated: content.length > MAX_CONTENT_CHARS,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('fetch_webpage: error leyendo URL', { url, error: msg });
      return {
        success: false,
        error: `No se pudo leer ${parsedUrl.toString()}: ${msg}`,
      };
    }
  },
};
