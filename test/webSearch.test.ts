import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { webSearchTool } from '../src/tools/implementations/webSearch.js';
import { env } from '../src/config/env.js';

type FetchLike = typeof fetch;

const originalFetch = globalThis.fetch;
const originalTavilyKey = env.TAVILY_API_KEY;
const originalBraveKey = env.BRAVE_SEARCH_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.TAVILY_API_KEY = originalTavilyKey;
  env.BRAVE_SEARCH_API_KEY = originalBraveKey;
});

describe('web search behavior', () => {
  it('should fallback to Brave when Tavily fails', async () => {
    env.TAVILY_API_KEY = 'tavily-test-key';
    env.BRAVE_SEARCH_API_KEY = 'brave-test-key';

    const fetchMock: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes('api.tavily.com')) {
        throw new Error('timeout');
      }
      if (url.includes('api.search.brave.com')) {
        return new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: 'Empresa X',
                  url: 'https://example.com',
                  description: 'Lead relevante',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    };

    globalThis.fetch = fetchMock;

    const result = await webSearchTool.execute({ query: 'empresas qlik', max_results: 3 });
    assert.equal(result.success, true);
    assert.equal((result.data as { source: string }).source, 'brave');
  });

  it('should send timeout signal in provider requests', async () => {
    env.TAVILY_API_KEY = 'tavily-test-key';
    env.BRAVE_SEARCH_API_KEY = undefined;

    const seenSignals: Array<AbortSignal | null | undefined> = [];
    const fetchMock: FetchLike = async (_input, init) => {
      seenSignals.push(init?.signal);
      return new Response(
        JSON.stringify({
          results: [{ title: 'A', url: 'https://a.com', content: 'x', score: 0.8 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    globalThis.fetch = fetchMock;

    const result = await webSearchTool.execute({ query: 'qlik partner', max_results: 2 });
    assert.equal(result.success, true);
    assert.equal(seenSignals.length, 1);
    assert.ok(seenSignals[0]);
  });
});
