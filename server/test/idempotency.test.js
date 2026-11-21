import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { digest } from '../src/auth.js';
test('a retried booking creates one order and keeps its original receipt', async (t) => {
  const f = await fixture(t);
  const body = {
    requestId: crypto.randomUUID(),
    address: 'Test street 123',
    phone: '9876543210',
    pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    slot: '09:00–12:00',
    items: [{ serviceId: 'wash-fold', quantity: 1 }],
  };
  const first = await f.customer('/orders', { method: 'POST', body });
  const retry = await f.customer('/orders', { method: 'POST', body });
  assert.equal(first.status, 201);
  assert.deepEqual(first.data, retry.data);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 1);
  const changed = await f.customer('/orders', {
    method: 'POST',
    body: { ...body, address: 'Different address' },
  });
  assert.equal(changed.status, 409);
});
test('delivery code retries return the code that is actually active', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  const body = f.action(order);
  const first = await f.customer(`/orders/${order.id}/delivery-code`, { method: 'POST', body });
  const retry = await f.customer(`/orders/${order.id}/delivery-code`, { method: 'POST', body });
  assert.equal(first.data.deliveryCode, retry.data.deliveryCode);
  assert.equal(
    f.db.prepare('SELECT delivery_code_hash FROM orders WHERE id=?').get(order.id)
      .delivery_code_hash,
    digest(first.data.deliveryCode),
  );
  assert.ok(!JSON.stringify(first.data.order).includes('privateDeliveryCode'));
});
test('reusing an action id with another body is rejected and cancelled orders stay closed', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  const body = f.action(order);
  await f.customer(`/orders/${order.id}/cancel`, { method: 'POST', body });
  const reuse = await f.customer(`/orders/${order.id}/cancel`, {
    method: 'POST',
    body: { ...body, version: 99 },
  });
  assert.equal(reuse.status, 409);
  const closed = await f.staff(`/orders/${order.id}/advance`, {
    method: 'POST',
    body: f.action({ ...order, version: 1 }),
  });
  assert.equal(closed.status, 409);
});
