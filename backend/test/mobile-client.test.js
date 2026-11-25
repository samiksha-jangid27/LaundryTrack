import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { createHttpClient } from '../../frontend/src/lib/http.js';
import { createScanQueue } from '../../frontend/src/lib/scan-queue.js';
import { createRetryRequest } from '../../frontend/src/lib/retry.js';

test('mobile transport completes booking, labels, uncertain scan replay, partial returns and owner export', async (t) => {
  const f = await fixture(t);
  let token = f.users.customer.token;
  let loseScanResponse = true;
  const client = createHttpClient({
    getBaseUrl: () => f.baseUrl,
    getToken: () => token,
    fetchImpl: async (url, options) => {
      const response = await fetch(url, options);
      if (url.endsWith('/scan') && loseScanResponse) {
        loseScanResponse = false;
        await response.text(); // The API committed the scan, but the phone lost the response.
        throw new Error('Connection lost');
      }
      return response;
    },
  });
  let order = (
    await client('/orders', {
      method: 'POST',
      body: {
        requestId: randomUUID(),
        address: 'Mobile test street',
        phone: '9876543210',
        pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        slot: '09:00–12:00',
        items: [{ serviceId: 'wash-fold', quantity: 2 }],
      },
    })
  ).order;
  const deliveryCode = order.deliveryCode;
  assert.equal((await client('/orders')).orders[0].in_care_count, 0);
  token = f.users.staff.token;
  const retry = createRetryRequest(randomUUID);
  async function act(route, values = {}) {
    const body = retry.prepare(JSON.stringify({ route, values }), {
      version: order.version,
      ...values,
    });
    const result = await client(`/orders/${order.id}/${route}`, { method: 'POST', body });
    retry.clear();
    order = result.order;
  }
  await act('collect', { count: 2 });
  assert.equal((await client('/orders')).orders[0].in_care_count, 2);
  await act('garments', { type: 'Shirt', color: 'Blue' });
  await act('garments', { type: 'Trousers', color: 'Black' });
  const labels = (await client(`/orders/${order.id}/labels`)).labels;
  assert.equal(labels.length, 2);
  assert.equal(labels[0].payload, `laundrytrack:garment:${order.garments[0].id}`);
  assert.equal(
    Buffer.from(labels[0].image.split(',')[1], 'base64').subarray(1, 4).toString(),
    'PNG',
  );
  for (let index = 0; index < 4; index++) await act('advance');
  const pending = [];
  const queue = createScanQueue({
    listPending: () => [...pending],
    addPending: (_, action) => pending.push(action),
    removePending: (id) =>
      pending.splice(
        pending.findIndex((action) => action.body.eventId === id),
        1,
      ),
    makeId: randomUUID,
    send: (action) =>
      client(`/orders/${action.orderId}/scan`, { method: 'POST', body: action.body }),
  });
  assert.equal((await queue.scan(f.users.staff.id, order, order.garments[0].id)).queued, true);
  assert.equal((await queue.scan(f.users.staff.id, order, order.garments[1].id)).queued, true);
  assert.deepEqual(
    pending.map((action) => action.body.version),
    [order.version, order.version + 1],
  );
  const sync = await queue.sync(f.users.staff.id);
  assert.equal(sync.error, null);
  assert.equal(sync.sent, 2);
  assert.equal(sync.remaining, 0);
  order = (await client(`/orders/${order.id}`)).order;
  assert.equal(order.garments.filter((garment) => garment.packed).length, 2);
  assert.equal(order.events.filter((event) => event.kind === 'packed').length, 2);
  await act('advance');
  await act('advance');
  await act('deliver', { code: deliveryCode, garmentIds: [order.garments[0].id] });
  assert.equal((await client('/orders')).orders[0].in_care_count, 1);
  await act('deliver', { code: deliveryCode, garmentIds: [order.garments[1].id] });
  assert.equal(order.stage, 'delivered');
  assert.equal((await client('/orders')).orders[0].in_care_count, 0);
  await assert.rejects(client('/outlet/export', { responseType: 'text' }), { status: 403 });
  token = f.users.owner.token;
  const csv = await client('/outlet/export', { responseType: 'text' });
  assert.ok(csv.startsWith('Order,Stage,Pickup,Total (paise)'));
  assert.ok(csv.includes(order.number));
});

test('native transport reacts to revoked sessions and does not reveal labels to customers', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  let invalidations = 0;
  const client = createHttpClient({
    getBaseUrl: () => f.baseUrl,
    getToken: () => f.users.customer.token,
    onUnauthorized: () => invalidations++,
  });
  await assert.rejects(client(`/orders/${order.id}/labels`), { status: 403 });
  await client('/auth/logout', { method: 'POST' });
  await assert.rejects(client('/orders'), { status: 401 });
  assert.equal(invalidations, 1);
});

test('API-only server returns JSON for missing routes, malformed input and oversized requests', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(f.baseUrl + '/')).status, 404);
  const malformed = await fetch(f.baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'Invalid JSON');
  const oversized = await fetch(f.baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(40000) }),
  });
  assert.equal(oversized.status, 413);
});
