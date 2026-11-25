import test from 'node:test';
import assert from 'node:assert/strict';
import { createScanQueue } from '../src/lib/scan-queue.js';

function fixture(send) {
  const pending = [];
  let ids = 0;
  const queue = createScanQueue({
    listPending: (user) =>
      pending.filter((entry) => entry.user === user).map((entry) => entry.action),
    addPending: (user, action) => pending.push({ user, action }),
    removePending: (id) =>
      pending.splice(
        pending.findIndex((entry) => entry.action.body.eventId === id),
        1,
      ),
    send,
    makeId: () => `event-${++ids}`,
  });
  const order = {
    id: 'order-1',
    stage: 'packing',
    version: 8,
    garments: [
      { id: 'shirt', packed: 0 },
      { id: 'trousers', packed: 0 },
    ],
  };
  return { queue, order, pending };
}

test('offline scan validation rejects foreign and duplicate garments and assigns sequential versions', async () => {
  const f = fixture(async () => {
    throw Object.assign(new Error('offline'), { offline: true });
  });
  await assert.rejects(f.queue.scan('staff', f.order, 'foreign'), /Wrong order/);
  assert.equal((await f.queue.scan('staff', f.order, 'shirt')).queued, true);
  await assert.rejects(f.queue.scan('staff', f.order, 'shirt'), /already been scanned/);
  await f.queue.scan('staff', f.order, 'trousers');
  assert.deepEqual(
    f.pending.map(({ action }) => action.body.version),
    [8, 9],
  );
  assert.equal((await f.queue.sync('other-user')).remaining, 0);
  assert.equal(f.pending.length, 2);
});

test('definitive scan rejection is removed while uncertain server failures stay saved', async () => {
  const rejected = fixture(async () => {
    throw Object.assign(new Error('Order changed'), { status: 409 });
  });
  await assert.rejects(rejected.queue.scan('staff', rejected.order, 'shirt'), { status: 409 });
  assert.equal(rejected.pending.length, 0);
  const uncertain = fixture(async () => {
    throw Object.assign(new Error('Server failed'), { status: 500 });
  });
  assert.equal((await uncertain.queue.scan('staff', uncertain.order, 'shirt')).queued, true);
  assert.equal(uncertain.pending.length, 1);
});

test('a scan is durably saved before the first request is sent', async () => {
  const f = fixture(async (action) => {
    assert.equal(f.pending[0].action.body.eventId, action.body.eventId);
    return { order: { ...f.order, version: 9 } };
  });
  assert.equal((await f.queue.scan('staff', f.order, 'shirt')).queued, false);
  assert.equal(f.pending.length, 0);
});
