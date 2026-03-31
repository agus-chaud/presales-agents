import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseToolArguments } from '../src/llm/parseToolArguments.js';

describe('tool arguments parsing behavior', () => {
  it('should parse valid json object arguments', () => {
    const parsed = parseToolArguments('TestProvider', 'web_search', '{"query":"qlik"}');
    assert.deepEqual(parsed, { query: 'qlik' });
  });

  it('should reject malformed json instead of returning empty object', () => {
    const parsed = parseToolArguments('TestProvider', 'web_search', '{"query":');
    assert.equal(parsed, null);
  });

  it('should reject non-object json payloads', () => {
    const parsed = parseToolArguments('TestProvider', 'web_search', '"string value"');
    assert.equal(parsed, null);
  });
});
