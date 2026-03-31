// Herramienta de búsqueda web: Tavily (primario) → Brave Search (fallback).
// Tavily está diseñada para agentes IA y devuelve contenido pre-extraído.
// Brave Search API es el fallback: free tier 2000 req/mes.
// DECISIÓN DEC-010: ver docs/decisiones-tecnicas.md
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { Tool, ToolResult } from '../types.js';

const WEB_SEARCH_TIMEOUT_MS = 12_000;

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

async function searchWithTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
    }),
    signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Tavily error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as {
    results: Array<{ title: string; url: string; content: string; score: number }>;
  };

  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}

async function searchWithBrave(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY ?? '',
    },
    signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Brave Search error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as {
    web?: { results: Array<{ title: string; url: string; description: string }> };
  };

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.description,
  }));
}

export const webSearchTool: Tool = {
  schema: {
    name: 'web_search',
    description:
      'Busca en la web usando una query. Devuelve una lista de resultados con título, URL y contenido resumido. ' +
      'Úsala para encontrar empresas, noticias, o información sobre un tema específico.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La query de búsqueda. Sé específico: incluí industria, país, tecnología, etc.',
        },
        max_results: {
          type: 'number',
          description: 'Cantidad máxima de resultados a devolver. Por defecto 5. Máximo 10.',
        },
      },
      required: ['query'],
    },
  },

  async execute(args): Promise<ToolResult> {
    const query = typeof args['query'] === 'string' ? args['query'] : '';
    // Coerción defensiva: el LLM a veces pasa max_results como string "5" en vez de number 5
    const rawMax = args['max_results'];
    const maxResults = Math.min(Math.max(1, Number(rawMax) || 5), 10);

    if (!query.trim()) {
      return { success: false, error: 'La query no puede estar vacía.' };
    }

    // Intentar Tavily primero
    if (env.TAVILY_API_KEY) {
      try {
        logger.debug('web_search: usando Tavily', { query });
        const results = await searchWithTavily(query, maxResults);
        return { success: true, data: { results, source: 'tavily' } };
      } catch (err) {
        logger.warn('Tavily falló, intentando Brave Search', { error: String(err) });
      }
    }

    // Fallback a Brave Search
    if (env.BRAVE_SEARCH_API_KEY) {
      try {
        logger.debug('web_search: usando Brave Search (fallback)', { query });
        const results = await searchWithBrave(query, maxResults);
        return { success: true, data: { results, source: 'brave' } };
      } catch (err) {
        logger.warn('Brave Search falló', { error: String(err) });
      }
    }

    // Ambas fallaron o no hay API keys configuradas
    const missingKeys: string[] = [];
    if (!env.TAVILY_API_KEY) missingKeys.push('TAVILY_API_KEY');
    if (!env.BRAVE_SEARCH_API_KEY) missingKeys.push('BRAVE_SEARCH_API_KEY');

    const msg = missingKeys.length > 0
      ? `Búsqueda web no disponible. Configurar en .env: ${missingKeys.join(', ')}`
      : 'Búsqueda web falló en todos los proveedores. Intentá de nuevo más tarde.';

    return { success: false, error: msg };
  },
};
