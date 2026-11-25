import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
test('booking snapshots price and rejects invalid catalog or quantity', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  assert.equal(order.total, 7000);
  await f.db.service.update({ where: { id: 'wash-fold' }, data: { price: 99999 } });
  assert.equal((await f.customer(`/orders/${order.id}`)).data.order.items[0].price, 3500);
  assert.equal(order.garments.length, 0);
  assert.equal(order.expected_count, 2);
  assert.ok(!JSON.stringify(order).includes('delivery_code_hash'));
  const body = {
    address: 'Test street 123',
    phone: '9876543210',
    pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    slot: '09:00–12:00',
    items: [{ serviceId: 'unavailable-service', quantity: 1 }],
  };
  assert.equal((await f.customer('/orders', { method: 'POST', body })).status, 400);
  for (const quantity of [0, -1, 1.5, 31]) {
    assert.equal(
      (
        await f.customer('/orders', {
          method: 'POST',
          body: { ...body, items: [{ serviceId: 'wash-fold', quantity }] },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await f.customer('/orders', {
        method: 'POST',
        body: {
          ...body,
          pickupDate: '2026-11-31',
          items: [{ serviceId: 'wash-fold', quantity: 1 }],
        },
      })
    ).status,
    400,
  );
});
test('custody enforces pickup counts, full intake, wrong-order and duplicate scans', async (t) => {
  const f = await fixture(t);
  let order = await f.book();
  const code = order.deliveryCode;
  let r = await f.staff(`/orders/${order.id}/collect`, {
    method: 'POST',
    body: f.action(order, { count: 1 }),
  });
  assert.equal(r.status, 409);
  order = await f.mutate(order, 'collect', { count: 2 });
  r = await f.staff(`/orders/${order.id}/advance`, { method: 'POST', body: f.action(order) });
  assert.equal(r.status, 409);
  for (let i = 0; i < 2; i++)
    order = await f.mutate(order, 'garments', {
      type: 'Shirt',
      color: i ? 'White' : 'Blue',
      note: '',
    });
  for (let i = 0; i < 4; i++) order = await f.mutate(order, 'advance');
  assert.equal(order.stage, 'packing');
  r = await f.staff(`/orders/${order.id}/advance`, { method: 'POST', body: f.action(order) });
  assert.equal(r.status, 409);
  const other = await f.book(1);
  const foreignId = crypto.randomUUID();
  await f.db.garment.create({
    data: { id: foreignId, order_id: other.id, type: 'Shirt', color: 'Red', note: '' },
  });
  r = await f.staff(`/orders/${order.id}/scan`, {
    method: 'POST',
    body: f.action(order, { garmentId: foreignId }),
  });
  assert.equal(r.status, 409);
  order = await f.mutate(order, 'scan', { garmentId: order.garments[0].id });
  r = await f.staff(`/orders/${order.id}/scan`, {
    method: 'POST',
    body: f.action(order, { garmentId: order.garments[0].id }),
  });
  assert.equal(r.status, 409);
  order = await f.mutate(order, 'scan', { garmentId: order.garments[1].id });
  order = await f.mutate(order, 'advance');
  order = await f.mutate(order, 'advance');
  r = await f.staff(`/orders/${order.id}/deliver`, {
    method: 'POST',
    body: f.action(order, { code: '000000', garmentIds: [order.garments[0].id] }),
  });
  assert.equal(r.status, 403);
  order = await f.mutate(order, 'deliver', { code, garmentIds: [order.garments[0].id] });
  assert.equal(order.stage, 'out_for_delivery');
  assert.equal(order.garments.filter((g) => g.delivered).length, 1);
  order = await f.mutate(order, 'deliver', { code, garmentIds: [order.garments[1].id] });
  assert.equal(order.stage, 'delivered');
});
test('retry actions apply once and stale updates cannot overwrite new versions', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  const body = f.action(order, { count: 2 });
  const first = await f.staff(`/orders/${order.id}/collect`, { method: 'POST', body });
  const retry = await f.staff(`/orders/${order.id}/collect`, { method: 'POST', body });
  assert.deepEqual(first.data, retry.data);
  assert.equal(first.data.order.version, 1);
  const stale = await f.staff(`/orders/${order.id}/garments`, {
    method: 'POST',
    body: f.action(order, { type: 'Shirt', color: 'Blue' }),
  });
  assert.equal(stale.status, 409);
  assert.equal(await f.db.event.count({ where: { order_id: order.id, kind: 'collected' } }), 1);
});
