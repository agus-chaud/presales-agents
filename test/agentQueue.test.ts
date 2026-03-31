import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enqueueAgent, isAgentBusy } from '../src/bot/agentQueue.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitFor(condition: () => boolean, retries = 20): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail('Condition not met within expected time');
}

describe('agentQueue behavior', () => {
  it('should execute tasks sequentially for same user', async () => {
    const userId = 91_001;
    const events: string[] = [];

    const firstGate = deferred<void>();
    const secondGate = deferred<void>();

    const first = enqueueAgent(userId, async () => {
      events.push('first:start');
      await firstGate.promise;
      events.push('first:end');
      return 'first';
    });

    const second = enqueueAgent(userId, async () => {
      events.push('second:start');
      await secondGate.promise;
      events.push('second:end');
      return 'second';
    });

    await Promise.resolve();
    assert.equal(isAgentBusy(userId), true);
    assert.deepEqual(events, ['first:start']);

    firstGate.resolve();
    await first;
    await waitFor(() => events.includes('second:start'));
    assert.deepEqual(events, ['first:start', 'first:end', 'second:start']);
    assert.equal(isAgentBusy(userId), true);

    secondGate.resolve();
    await second;
    assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
    assert.equal(isAgentBusy(userId), false);
  });

  it('should keep queue busy while a later task is still running', async () => {
    const userId = 91_002;
    const firstGate = deferred<void>();
    const secondGate = deferred<void>();

    const first = enqueueAgent(userId, async () => {
      await firstGate.promise;
      return 'done-1';
    });

    const second = enqueueAgent(userId, async () => {
      await secondGate.promise;
      return 'done-2';
    });

    assert.equal(isAgentBusy(userId), true);

    firstGate.resolve();
    await first;
    // Si el cleanup del primero borra la cola por error, este assert falla.
    assert.equal(isAgentBusy(userId), true);

    secondGate.resolve();
    await second;
    assert.equal(isAgentBusy(userId), false);
  });
});
