import test from 'node:test';
import assert from 'node:assert/strict';
import { flushActions } from '../src/lib/sync.js';
test('sync preserves failed action and later scans when a version conflicts', async () => {
  const actions = [0, 1, 2].map((i) => ({ body: { eventId: String(i), version: i } }));
  const removed = [];
  const calls = [];
  const result = await flushActions({
    actions,
    send: async (a) => {
      calls.push(a.body.eventId);
      if (a.body.version === 1) throw Object.assign(new Error('Refresh required'), { status: 409 });
    },
    remove: (id) => removed.push(id),
  });
  assert.deepEqual(removed, ['0']);
  assert.deepEqual(calls, ['0', '1']);
  assert.equal(result.remaining, 2);
  assert.equal(result.error.status, 409);
});
test('retry keeps original event id and removes only acknowledged actions', async () => {
  const action = { body: { eventId: 'original-id', version: 3 } };
  const sent = [];
  const removed = [];
  const result = await flushActions({
    actions: [action],
    send: async (a) => sent.push(a),
    remove: (id) => removed.push(id),
  });
  assert.equal(sent[0], action);
  assert.deepEqual(removed, ['original-id']);
  assert.equal(result.remaining, 0);
});
