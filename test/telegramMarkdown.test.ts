import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeTelegramMarkdown } from '../src/utils/telegramMarkdown.js';

describe('telegram markdown escaping behavior', () => {
  it('should escape markdown control characters in user text', () => {
    const input = 'ACME_[test]*`x`';
    const escaped = escapeTelegramMarkdown(input);
    assert.equal(escaped, 'ACME\\_\\[test]\\*\\`x\\`');
  });

  it('should keep plain text unchanged', () => {
    const input = 'Mensaje normal sin formato';
    const escaped = escapeTelegramMarkdown(input);
    assert.equal(escaped, input);
  });
});
