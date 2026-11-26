import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
test('customer issues retain outlet resolution and audit history', async (t) => {
  const f = await fixture(t);
  let order = await f.book();
  order = await f.mutate(
    order,
    'issues',
    { category: 'billing', message: 'Please clarify the wash and fold charges.' },
    f.customer,
  );
  assert.equal(order.issues.length, 1);
  assert.equal((await f.customer('/outlet/issues')).status, 403);
  const queue = await f.staff('/outlet/issues');
  assert.equal(queue.data.issues[0].order.id, order.id);
  assert.equal(queue.data.issues[0].order.customer.name, 'customer');
  order = await f.mutate(order, `issues/${order.issues[0].id}/resolve`, {
    resolution: 'Explained the item pricing on the booking receipt.',
  });
  assert.equal(order.issues[0].status, 'resolved');
  assert.ok(order.events.some((e) => e.kind === 'resolved'));
  assert.equal((await f.staff('/outlet/issues')).data.issues.length, 0);
});
test('cancellation is only allowed before accepting custody', async (t) => {
  const f = await fixture(t);
  let order = await f.book();
  order = await f.mutate(order, 'collect', { count: 2 });
  const r = await f.customer(`/orders/${order.id}/cancel`, {
    method: 'POST',
    body: f.action(order),
  });
  assert.equal(r.status, 409);
});
