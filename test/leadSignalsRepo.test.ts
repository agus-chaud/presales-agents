import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, getDb, isSqliteAvailable } from '../src/db/database.js';
import { leadSignalsRepo } from '../src/db/repositories/leadSignalsRepo.js';
import { normalizeLeadSignal } from '../src/leads/signalsContract.js';

initDatabase();
const describeLeadSignalsRepo = isSqliteAvailable() ? describe : describe.skip;

describeLeadSignalsRepo('leadSignalsRepo behavior', () => {
  before(() => {
    assert.equal(isSqliteAvailable(), true, 'SQLite debe estar disponible para estos tests');
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM lead_signals').run();
  });

  after(() => {
    getDb().prepare('DELETE FROM lead_signals').run();
  });

  it('dedupes signals by deterministic signal_key', async () => {
    const baseSignal = normalizeLeadSignal({
      post_url: 'https://linkedin.com/posts/abc',
      author: 'Jane Doe',
      company: 'Acme',
      text: 'Estamos evaluando herramientas de prospeccion.',
      timestamp: '2026-04-07T09:30:00.000Z',
      engagement: { likes: 2, comments: 1, reposts: 0 },
      topic_signals: ['prospecting'],
      intent_signals: ['evaluating_tools'],
    });

    const duplicateSignal = normalizeLeadSignal({
      post_url: 'https://linkedin.com/posts/abc',
      author: 'Jane Doe',
      company: 'Acme',
      text: 'Texto diferente pero mismo bucket.',
      timestamp: '2026-04-07T11:05:00.000Z',
      engagement: { likes: 8, comments: 4, reposts: 1 },
      topic_signals: ['prospecting'],
      intent_signals: ['evaluating_tools'],
    });

    const result = await leadSignalsRepo.saveMany([baseSignal, duplicateSignal]);
    const recent = await leadSignalsRepo.listRecent(10);

    assert.deepEqual(result, { inserted: 1, ignored: 1 });
    assert.equal(recent.length, 1);
    assert.equal(recent[0]?.signal_key, baseSignal.signal_key);
  });

  it('persists status transitions', async () => {
    const signal = normalizeLeadSignal({
      post_url: 'https://linkedin.com/posts/status-test',
      author: 'John Smith',
      company: 'Globex',
      text: 'Que stack recomiendan para outreach?',
      timestamp: '2026-04-07T12:00:00.000Z',
      engagement: { likes: 3, comments: 2, reposts: 0 },
      topic_signals: ['outreach'],
      intent_signals: ['asks_recommendation'],
    });

    await leadSignalsRepo.saveMany([signal]);
    const inserted = await leadSignalsRepo.listRecent(1);
    const id = inserted[0]?.id;

    assert.ok(id);
    assert.equal(inserted[0]?.status, 'new');

    await leadSignalsRepo.updateStatus(id!, 'reviewed');
    const updated = await leadSignalsRepo.listRecent(1);

    assert.equal(updated[0]?.status, 'reviewed');
  });
});
