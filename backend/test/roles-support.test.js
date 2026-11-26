import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';

const raise = (actor, values = {}) =>
  actor('/support', {
    method: 'POST',
    body: {
      requestId: randomUUID(),
      subject: 'Please help with my pickup',
      category: 'pickup',
      message: 'Please help me understand the pickup arrangements.',
      ...values,
    },
  });
const editUser = async (f, id, values) => {
  const user = await f.db.user.findUnique({ where: { id } });
  return f.owner(`/management/users/${id}`, {
    method: 'PATCH',
    body: { version: user.version, ...values },
  });
};

test('staff access requires owner approval, revokes old sessions, and records account activity', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.customer('/management/users')).status, 403);
  assert.equal((await f.staff('/management/activity')).status, 403);
  const requested = await f.customer('/auth/staff-request', { method: 'POST' });
  assert.equal(requested.data.user.role, 'customer');
  assert.equal(requested.data.user.staffRequestStatus, 'pending');
  const queue = await f.owner('/management/users?state=pending');
  assert.equal(queue.data.staffRequests, 1);
  assert.equal(queue.data.users[0].id, f.users.customer.id);
  assert.equal((await editUser(f, f.users.customer.id, { role: 'staff' })).status, 200);
  assert.equal((await f.customer('/orders')).status, 401);
  const login = await f.request('/auth/login', {
    method: 'POST',
    body: { email: 'customer@test.example', password: 'test-password-123' },
  });
  assert.equal(login.data.user.role, 'staff');
  assert.equal(login.data.user.staffRequestStatus, 'approved');
  const activity = await f.owner('/management/activity');
  assert.ok(activity.data.activity.some((entry) => entry.kind === 'staff_request'));
  assert.ok(activity.data.activity.some((entry) => entry.detail.includes('customer → staff')));
});

test('staff request declines are visible to the customer and can be requested again', async (t) => {
  const f = await fixture(t);
  await f.customer('/auth/staff-request', { method: 'POST' });
  await editUser(f, f.users.customer.id, { dismissStaffRequest: true });
  assert.equal((await f.customer('/auth/me')).data.user.staffRequestStatus, 'declined');
  assert.equal(
    (await f.customer('/auth/staff-request', { method: 'POST' })).data.user.staffRequestStatus,
    'pending',
  );
});

test('owner accounts and privilege changes cannot be altered through self-service APIs', async (t) => {
  const f = await fixture(t);
  assert.equal((await editUser(f, f.users.owner.id, { active: false })).status, 403);
  assert.equal((await editUser(f, f.users.customer.id, { role: 'owner' })).status, 400);
  const profile = await f.customer('/auth/profile', {
    method: 'PATCH',
    body: { name: 'Updated name', phone: '9876543211', role: 'owner', active: true },
  });
  assert.equal(profile.data.user.role, 'customer');
  assert.equal(profile.data.user.name, 'Updated name');
  const target = await f.db.user.findUnique({ where: { id: f.users.staff.id } });
  const request = { version: target.version, active: false };
  assert.equal(
    (await f.owner(`/management/users/${target.id}`, { method: 'PATCH', body: request })).status,
    200,
  );
  assert.equal(
    (await f.owner(`/management/users/${target.id}`, { method: 'PATCH', body: request })).status,
    409,
  );
});

test('staff see only assigned work and can separately book and read their personal orders', async (t) => {
  const f = await fixture(t);
  const other = await f.book(1, false);
  assert.equal((await f.staff('/orders')).data.orders.length, 0);
  assert.equal((await f.staff(`/orders/${other.id}`)).status, 404);
  assert.equal((await f.owner('/orders')).data.orders.length, 1);
  assert.equal(
    (
      await f.staff(`/orders/${other.id}/assign`, {
        method: 'POST',
        body: f.action(other, { staffId: f.users.staff.id }),
      })
    ).status,
    403,
  );
  const input = {
    address: 'Personal street 123',
    phone: '9876543210',
    pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    slot: '09:00–12:00',
    items: [{ serviceId: 'wash-fold', quantity: 1 }],
  };
  const personal = await f.staff('/orders', { method: 'POST', body: input });
  assert.equal(personal.status, 201);
  assert.equal(personal.data.order.customer_id, f.users.staff.id);
  assert.equal((await f.staff('/orders?scope=mine')).data.orders[0].id, personal.data.order.id);
  assert.equal(
    (
      await f.staff(`/orders/${personal.data.order.id}/collect`, {
        method: 'POST',
        body: f.action(personal.data.order, { count: 1 }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.staff(`/orders/${personal.data.order.id}/issues`, {
        method: 'POST',
        body: f.action(personal.data.order, {
          category: 'billing',
          message: 'Please clarify my personal booking price.',
        }),
      })
    ).status,
    201,
  );
});

test('customer query flows through owner assignment, staff reply, resolution and customer reopening', async (t) => {
  const f = await fixture(t);
  let response = await raise(f.customer);
  assert.equal(response.status, 201);
  let ticket = response.data.ticket;
  assert.equal((await f.staff(`/support/${ticket.id}`)).status, 404);
  assert.equal((await f.owner('/support')).data.tickets[0].id, ticket.id);
  response = await f.owner(`/support/${ticket.id}`, {
    method: 'PATCH',
    body: f.action(ticket, { assignedTo: f.users.staff.id, status: 'in_progress' }),
  });
  ticket = response.data.ticket;
  assert.equal((await f.staff(`/support/${ticket.id}`)).status, 200);
  response = await f.staff(`/support/${ticket.id}/messages`, {
    method: 'POST',
    body: f.action(ticket, { message: 'Pickup is confirmed for the selected window.' }),
  });
  ticket = response.data.ticket;
  assert.equal(ticket.messages.at(-1).author_role, 'staff');
  ticket = (
    await f.staff(`/support/${ticket.id}`, {
      method: 'PATCH',
      body: f.action(ticket, { status: 'resolved' }),
    })
  ).data.ticket;
  assert.equal(ticket.status, 'resolved');
  ticket = (
    await f.customer(`/support/${ticket.id}/messages`, {
      method: 'POST',
      body: f.action(ticket, { message: 'I need to ask one more question.' }),
    })
  ).data.ticket;
  assert.equal(ticket.status, 'open');
  assert.equal(ticket.messages.at(-1).author_role, 'customer');
});

test('staff queries are private to the requester and owner, never assigned to other staff', async (t) => {
  const f = await fixture(t);
  const response = await raise(f.staff, {
    category: 'operations',
    subject: 'Equipment maintenance request',
  });
  const ticket = response.data.ticket;
  assert.equal((await f.customer(`/support/${ticket.id}`)).status, 404);
  assert.equal((await f.customer('/support')).data.tickets.length, 0);
  assert.equal(
    (
      await f.owner(`/support/${ticket.id}`, {
        method: 'PATCH',
        body: f.action(ticket, { assignedTo: f.users.staff.id }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.owner(`/support/${ticket.id}/messages`, {
        method: 'POST',
        body: f.action(ticket, { message: 'Maintenance has been scheduled.' }),
      })
    ).status,
    201,
  );
  assert.equal(
    (await f.staff(`/support/${ticket.id}`)).data.ticket.messages.at(-1).author_role,
    'owner',
  );
});

test('support retries do not duplicate queries or messages and stale updates are rejected', async (t) => {
  const f = await fixture(t);
  const body = {
    requestId: randomUUID(),
    subject: 'Question about billing',
    category: 'billing',
    message: 'Please clarify the item pricing on my receipt.',
  };
  const first = await f.customer('/support', { method: 'POST', body });
  const replay = await f.customer('/support', { method: 'POST', body });
  assert.equal(first.data.ticket.id, replay.data.ticket.id);
  assert.equal(await f.db.ticket.count(), 1);
  const ticket = first.data.ticket;
  const reply = f.action(ticket, { message: 'Adding more details to my query.' });
  assert.equal(
    (await f.customer(`/support/${ticket.id}/messages`, { method: 'POST', body: reply })).status,
    201,
  );
  assert.equal(
    (await f.customer(`/support/${ticket.id}/messages`, { method: 'POST', body: reply })).status,
    201,
  );
  assert.equal(
    await f.db.ticketMessage.count({ where: { ticket_id: ticket.id, kind: 'reply' } }),
    2,
  );
  assert.equal(
    (
      await f.customer(`/support/${ticket.id}/messages`, {
        method: 'POST',
        body: { ...reply, message: 'Changed the reused request body' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.owner(`/support/${ticket.id}`, {
        method: 'PATCH',
        body: f.action(ticket, { status: 'resolved' }),
      })
    ).status,
    409,
  );
});

test('a staff query remains private even after its requester becomes a customer', async (t) => {
  const f = await fixture(t);
  const ticket = (
    await raise(f.staff, { category: 'operations', subject: 'Private staff operations query' })
  ).data.ticket;
  await editUser(f, f.users.staff.id, { role: 'customer' });
  await editUser(f, f.users.customer.id, { role: 'staff' });
  const peer = await f.request('/auth/login', {
    method: 'POST',
    body: { email: 'customer@test.example', password: 'test-password-123' },
  });
  assert.equal((await f.request(`/support/${ticket.id}`, { token: peer.data.token })).status, 404);
  assert.equal(
    (
      await f.owner(`/support/${ticket.id}`, {
        method: 'PATCH',
        body: f.action(ticket, { assignedTo: f.users.customer.id }),
      })
    ).status,
    400,
  );
  assert.equal((await f.owner(`/support/${ticket.id}`)).data.ticket.requester_role, 'staff');
});

test('suspension revokes sessions and clears active order and query assignments for reassignment', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  const ticket = (await raise(f.customer)).data.ticket;
  await f.owner(`/support/${ticket.id}`, {
    method: 'PATCH',
    body: f.action(ticket, { assignedTo: f.users.staff.id }),
  });
  assert.equal((await editUser(f, f.users.staff.id, { active: false })).status, 200);
  assert.equal((await f.staff('/orders')).status, 401);
  assert.equal(
    (
      await f.request('/auth/login', {
        method: 'POST',
        body: { email: 'staff@test.example', password: 'test-password-123' },
      })
    ).status,
    403,
  );
  assert.equal((await f.db.order.findUnique({ where: { id: order.id } })).assigned_to, null);
  assert.equal((await f.db.ticket.findUnique({ where: { id: ticket.id } })).assigned_to, null);
  assert.equal((await f.owner(`/support/${ticket.id}`)).data.ticket.messages.at(-1).kind, 'system');
  assert.equal((await editUser(f, f.users.staff.id, { active: true })).status, 200);
  assert.equal(
    (
      await f.request('/auth/login', {
        method: 'POST',
        body: { email: 'staff@test.example', password: 'test-password-123' },
      })
    ).status,
    200,
  );
});
