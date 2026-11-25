import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';

test('care duration uses the longest booked service from the actual catalog', async (t) => {
  const f = await fixture(t);
  const created = await f.customer('/orders', {
    method: 'POST',
    body: {
      address: 'Test street 123',
      phone: '9876543210',
      pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      slot: '09:00–12:00',
      items: [
        { serviceId: 'wash-fold', quantity: 2 },
        { serviceId: 'dry-clean', quantity: 1 },
      ],
    },
  });
  assert.equal(created.status, 201);
  const result = await f.customer(`/orders/${created.data.order.id}/estimate`);
  assert.equal(result.status, 200);
  assert.equal(result.data.estimate.hours, 72);
  assert.equal(result.data.estimate.source, 'catalog');
});

test('health response matches the mobile connection check and contains no sample-mode switch', async (t) => {
  const f = await fixture(t);
  const result = await f.request('/health');
  assert.deepEqual(result.data, { status: 'ok', version: '1.0.0' });
});
