import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadSignalsBatchSchema,
  normalizeLeadSignal,
} from '../src/leads/signalsContract.js';

describe('lead signals contract behavior', () => {
  it('accepts a valid python collector batch payload', () => {
    const payload = {
      collector: 'python-scrapling',
      collected_at: '2026-04-07T10:00:00.000Z',
      signals: [
        {
          post_url: 'https://linkedin.com/posts/example-1',
          author: 'Jane Doe',
          company: 'Acme',
          text: 'Busco recomendacion para automatizar pipeline.',
          timestamp: '2026-04-07T09:30:00.000Z',
          engagement: { likes: 12, comments: 3, reposts: 1 },
          topic_signals: ['automation', 'pipeline'],
          intent_signals: ['asks_recommendation'],
        },
      ],
    };

    const parsed = leadSignalsBatchSchema.parse(payload);
    const normalized = normalizeLeadSignal(parsed.signals[0]!);

    assert.equal(parsed.signals.length, 1);
    assert.equal(normalized.date_bucket, '2026-04-07');
    assert.equal(normalized.signal_key.includes('jane doe'.toLowerCase()), true);
  });

  it('rejects malformed payload when required fields are missing', () => {
    const payload = {
      collector: 'python-scrapling',
      signals: [
        {
          post_url: 'not-a-url',
          author: '',
          text: '',
          timestamp: 'bad-date',
        },
      ],
    };

    const result = leadSignalsBatchSchema.safeParse(payload);
    assert.equal(result.success, false);
  });
});
