import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { notify } from '../src/notifications.js';
import { transaction } from '../src/db.js';
import { deliverPushBatch, expoTransport } from '../src/push.js';

const device = (
  installationId = randomUUID(),
  token = 'ExpoPushToken[synthetic_token_123456789]',
) => ({ installationId, token, platform: 'android' });
async function notifyCustomer(f, key = randomUUID()) {
  await transaction(f.db, (tx) =>
    notify(tx, {
      key,
      userIds: [f.users.customer.id],
      category: 'order',
      title: 'Laundry on its way',
      body: 'Your order has an update.',
      targetType: 'orders',
    }),
  );
  return f.db.notification.findFirst({ where: { user_id: f.users.customer.id, event_key: key } });
}
const due = (f) => f.db.pushDelivery.updateMany({ data: { next_attempt: new Date(0) } });

test('bookings notify customer and owners once; assignment and progress reach only the right users', async (t) => {
  const f = await fixture(t);
  const order = await f.book(1, false);
  assert.equal((await f.customer('/notifications/summary')).data.unread, 1);
  assert.equal((await f.owner('/notifications/summary')).data.unread, 1);
  assert.equal((await f.staff('/notifications/summary')).data.unread, 0);
  const body = f.action(order, { staffId: f.users.staff.id });
  for (let i = 0; i < 2; i++) {
    const r = await f.owner(`/orders/${order.id}/assign`, { method: 'POST', body });
    assert.equal(r.status, 200);
  }
  assert.equal((await f.staff('/notifications/summary')).data.unread, 1);
  assert.equal((await f.customer('/notifications/summary')).data.unread, 2);
  const fresh = (await f.customer(`/orders/${order.id}`)).data.order;
  const collected = await f.mutate(fresh, 'collect', { count: 1 });
  assert.equal((await f.customer('/notifications/summary')).data.unread, 3);
  const before = await f.db.notification.count();
  await f.mutate(collected, 'garments', { type: 'Shirt', color: 'Blue', note: '' });
  assert.equal(
    await f.db.notification.count(),
    before,
    'individual intake must not spam notifications',
  );
  const rows = (await f.customer('/notifications')).data.notifications;
  assert.equal(rows[0].target_id, order.id);
  assert.equal(JSON.stringify(rows).includes(order.deliveryCode), false);
});

test('notification reads, pagination and preferences are scoped to the signed-in recipient', async (t) => {
  const f = await fixture(t);
  const other = await notifyCustomer(f, 'private');
  assert.equal((await f.staff(`/notifications/${other.id}`)).status, 404);
  assert.equal((await f.staff(`/notifications/${other.id}/read`, { method: 'PATCH' })).status, 404);
  assert.equal((await f.staff(`/notifications?before=${other.id}`)).status, 404);
  await f.db.notification.createMany({
    data: Array.from({ length: 54 }, (_, i) => ({
      user_id: f.users.customer.id,
      event_key: `page:${i}`,
      category: 'order',
      title: 'Update',
      body: 'Order update',
      target_type: 'orders',
      created_at: new Date(1700000000000),
    })),
  });
  const first = (await f.customer('/notifications')).data;
  const second = (await f.customer(`/notifications?before=${first.nextCursor}`)).data;
  assert.equal(first.notifications.length, 50);
  assert.equal(second.notifications.length, 5);
  assert.equal(
    new Set([...first.notifications, ...second.notifications].map((row) => row.id)).size,
    55,
  );
  assert.equal(
    (await f.customer(`/notifications/${other.id}/read`, { method: 'PATCH' })).status,
    204,
  );
  assert.equal((await f.customer('/notifications/summary')).data.unread, 54);
  const cutoff = new Date().toISOString();
  await f.customer('/notifications/read-all', { method: 'PATCH', body: { through: cutoff } });
  assert.equal((await f.customer('/notifications?filter=unread')).data.notifications.length, 0);
  await f.customer('/notifications/preferences', { method: 'PATCH', body: { pushEnabled: false } });
  assert.equal((await f.customer('/notifications/summary')).data.pushEnabled, false);
  assert.equal((await f.staff('/notifications/summary')).data.pushEnabled, true);
  assert.equal((await f.request('/notifications')).status, 401);
});

test('query replies, assignments and private staff queries produce role-safe notifications', async (t) => {
  const f = await fixture(t);
  const input = {
    requestId: randomUUID(),
    subject: 'Pickup timing question',
    category: 'pickup',
    message: 'Please help with my pickup timing.',
  };
  const r = await f.customer('/support', { method: 'POST', body: input });
  assert.equal(r.status, 201);
  await f.customer('/support', { method: 'POST', body: input });
  assert.equal(
    (await f.owner('/notifications/summary')).data.unread,
    1,
    'retry must not duplicate',
  );
  const assigned = await f.owner(`/support/${r.data.ticket.id}`, {
    method: 'PATCH',
    body: f.action(r.data.ticket, { assignedTo: f.users.staff.id }),
  });
  assert.equal(assigned.status, 200);
  const replyBody = f.action(assigned.data.ticket, { message: 'We will arrange the pickup.' });
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await f.staff(`/support/${r.data.ticket.id}/messages`, { method: 'POST', body: replyBody }))
        .status,
      201,
    );
  assert.equal((await f.customer('/notifications/summary')).data.unread, 2);
  const privateQuery = await f.staff('/support', {
    method: 'POST',
    body: {
      ...input,
      requestId: randomUUID(),
      category: 'operations',
      subject: 'Private staff concern',
    },
  });
  assert.equal(privateQuery.status, 201);
  const before = await f.db.notification.count({ where: { user_id: f.users.customer.id } });
  const privateReply = await f.owner(`/support/${privateQuery.data.ticket.id}/messages`, {
    method: 'POST',
    body: f.action(privateQuery.data.ticket, { message: 'I will handle this privately.' }),
  });
  assert.equal(privateReply.status, 201);
  assert.equal(await f.db.notification.count({ where: { user_id: f.users.customer.id } }), before);
  const notes = (await f.staff('/notifications')).data.notifications;
  assert.ok(notes.some((note) => note.target_id === privateQuery.data.ticket.id));
  assert.equal(JSON.stringify(notes).includes('I will handle this privately'), false);
});

test('staff requests and owner decisions notify owners and the affected account', async (t) => {
  const f = await fixture(t);
  await f.customer('/auth/staff-request', { method: 'POST' });
  await f.customer('/auth/staff-request', { method: 'POST' });
  assert.equal((await f.owner('/notifications/summary')).data.unread, 1);
  const current = await f.db.user.findUnique({ where: { id: f.users.customer.id } });
  const r = await f.owner(`/management/users/${current.id}`, {
    method: 'PATCH',
    body: { version: current.version, dismissStaffRequest: true },
  });
  assert.equal(r.status, 200);
  const notes = (await f.customer('/notifications')).data.notifications;
  assert.equal(notes[0].title, 'Staff request declined');
  assert.equal(notes[0].target_type, 'account');
});

test('device registration preserves queued work on refresh and clears it on account switching', async (t) => {
  const f = await fixture(t);
  const input = device();
  assert.equal(
    (await f.customer('/notifications/devices', { method: 'PUT', body: input })).status,
    204,
  );
  await notifyCustomer(f);
  await f.customer('/notifications/devices', { method: 'PUT', body: input });
  assert.equal(await f.db.pushDelivery.count(), 1);
  await f.staff(`/notifications/devices/${input.installationId}`, { method: 'DELETE' });
  assert.equal(await f.db.pushDevice.count(), 1, 'another user cannot delete a device');
  await f.staff('/notifications/devices', { method: 'PUT', body: input });
  assert.equal(await f.db.pushDelivery.count(), 0, 'previous account queue must be removed');
  assert.equal(
    (await f.db.pushDevice.findUnique({ where: { id: input.installationId } })).user_id,
    f.users.staff.id,
  );
  assert.equal(
    (
      await f.customer('/notifications/devices', {
        method: 'PUT',
        body: { ...input, token: 'not-a-token' },
      })
    ).status,
    400,
  );
});

test('transaction rollbacks and duplicate event keys never create extra inbox or push rows', async (t) => {
  const f = await fixture(t);
  await f.customer('/notifications/devices', { method: 'PUT', body: device() });
  for (let i = 0; i < 2; i++) await notifyCustomer(f, 'one-action');
  assert.equal(await f.db.notification.count(), 1);
  assert.equal(await f.db.pushDelivery.count(), 1);
  await assert.rejects(
    transaction(f.db, async (tx) => {
      await notify(tx, {
        key: 'rollback',
        userIds: [f.users.customer.id],
        category: 'account',
        title: 'Changed',
        body: 'Account changed',
        targetType: 'account',
      });
      throw new Error('Domain action failed');
    }),
    /Domain action failed/,
  );
  assert.equal(await f.db.notification.count(), 1);
});

test('push tickets and receipts are processed once per lease, with private content excluded', async (t) => {
  const f = await fixture(t);
  await f.customer('/notifications/devices', { method: 'PUT', body: device() });
  const note = await notifyCustomer(f);
  let sends = 0;
  const transport = {
    send: async (messages) => {
      sends++;
      assert.equal(messages.length, 1);
      assert.deepEqual(messages[0].data, { notificationId: note.id });
      assert.equal(messages[0].body.includes(note.body), false);
      return [{ status: 'ok', id: 'receipt-1' }];
    },
    receipts: async (ids) => {
      assert.deepEqual(ids, ['receipt-1']);
      return { 'receipt-1': { status: 'ok' } };
    },
  };
  await Promise.all([deliverPushBatch(f.db, transport), deliverPushBatch(f.db, transport)]);
  assert.equal(sends, 1);
  assert.equal((await f.db.pushDelivery.findFirst()).state, 'ticket');
  await due(f);
  await deliverPushBatch(f.db, transport);
  assert.equal((await f.db.pushDelivery.findFirst()).state, 'delivered');
  assert.equal(sends, 1);
});

test('push transport failures retry, receipt errors disable invalid devices and inbox stays intact', async (t) => {
  const f = await fixture(t);
  await f.customer('/notifications/devices', { method: 'PUT', body: device() });
  await notifyCustomer(f);
  await deliverPushBatch(f.db, {
    send: async () => {
      throw new Error('offline');
    },
  });
  const failed = await f.db.pushDelivery.findFirst();
  assert.equal(failed.state, 'pending');
  assert.equal(failed.attempts, 1);
  assert.ok(failed.next_attempt > new Date());
  await due(f);
  await deliverPushBatch(f.db, { send: async () => [{ status: 'ok', id: 'invalid-device' }] });
  await due(f);
  await deliverPushBatch(f.db, {
    receipts: async () => ({
      'invalid-device': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    }),
  });
  assert.equal((await f.db.pushDevice.findFirst()).enabled, false);
  assert.equal((await f.db.pushDelivery.findFirst()).state, 'failed');
  assert.equal((await f.customer('/notifications/summary')).data.unread, 1);
});

test('read alerts, paused preferences and suspended accounts suppress pending phone pushes', async (t) => {
  const f = await fixture(t);
  await f.customer('/notifications/devices', { method: 'PUT', body: device() });
  const note = await notifyCustomer(f, 'read');
  await f.customer(`/notifications/${note.id}/read`, { method: 'PATCH' });
  const transport = { send: async () => assert.fail('No phone message should be sent') };
  await deliverPushBatch(f.db, transport);
  assert.equal((await f.db.pushDelivery.findFirst()).state, 'skipped');
  await notifyCustomer(f, 'paused');
  await f.customer('/notifications/preferences', { method: 'PATCH', body: { pushEnabled: false } });
  await deliverPushBatch(f.db, transport);
  assert.equal(await f.db.pushDelivery.count({ where: { state: 'skipped' } }), 2);
  await notifyCustomer(f, 'while-paused');
  assert.equal(await f.db.pushDelivery.count(), 2);
  await f.customer('/notifications/preferences', { method: 'PATCH', body: { pushEnabled: true } });
  await notifyCustomer(f, 'suspended');
  await f.db.user.update({ where: { id: f.users.customer.id }, data: { active: false } });
  await deliverPushBatch(f.db, transport);
  assert.equal(await f.db.pushDelivery.count({ where: { state: 'skipped' } }), 3);
});

test('Expo transport uses the authenticated provider endpoints and classifies temporary errors', async () => {
  const requests = [];
  const transport = expoTransport(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ data: [] }) };
  }, 'synthetic-access-token');
  await transport.send([{ to: 'synthetic' }]);
  await transport.receipts(['ticket-1']);
  assert.equal(requests[0].url, 'https://exp.host/--/api/v2/push/send');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-access-token');
  assert.deepEqual(JSON.parse(requests[1].options.body), { ids: ['ticket-1'] });
  const unavailable = expoTransport(async () => ({ ok: false, status: 429 }));
  await assert.rejects(unavailable.send([]), (error) => error.code === 'transport');
});
