import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/db.js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
const testEnv = new URL('../.env.test', import.meta.url);
if (existsSync(testEnv)) loadEnvFile(testEnv);
import { initializeCatalog } from '../src/catalog.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { HttpError } from '../src/errors.js';
export async function fixture(t, { google = {}, sendCode } = {}) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error(
      'Set TEST_DATABASE_URL to a separate PostgreSQL database whose name ends in _test.',
    );
  const db = createDatabase(url);
  await db.$connect();
  await db.$transaction([
    db.pushDelivery.deleteMany(),
    db.pushDevice.deleteMany(),
    db.notification.deleteMany(),
    db.ticketMessage.deleteMany(),
    db.ticket.deleteMany(),
    db.accountEvent.deleteMany(),
    db.bookingRequest.deleteMany(),
    db.action.deleteMany(),
    db.event.deleteMany(),
    db.issue.deleteMany(),
    db.garment.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
    db.service.deleteMany(),
  ]);
  await initializeCatalog(db);
  const users = {};
  for (const role of ['customer', 'staff', 'owner']) {
    const id = randomUUID();
    await db.user.create({
      data: {
        id,
        name: role,
        email: `${role}@test.example`,
        phone: '9876543210',
        role,
        password_hash: hashPassword('test-password-123'),
        email_verified_at: new Date(),
      },
    });
    users[role] = { id };
  }
  const sent = [];
  const server = createApp(db, {
    sendCode:
      sendCode ||
      (async (message) => {
        sent.push(message);
      }),
    verifyGoogle: async (token) => {
      if (!google[token]) throw new HttpError(401, 'Invalid Google token');
      return google[token];
    },
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.$disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', body, token } = {}) {
    const r = await fetch(base + '/api' + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: r.status === 204 ? null : await r.json() };
  }
  for (const role of Object.keys(users)) {
    const r = await request('/auth/login', {
      method: 'POST',
      body: { email: `${role}@test.example`, password: 'test-password-123' },
    });
    users[role].token = r.data.token;
  }
  const customer = (path, options = {}) =>
    request(path, { token: users.customer.token, ...options });
  const staff = (path, options = {}) => request(path, { token: users.staff.token, ...options });
  const owner = (path, options = {}) => request(path, { token: users.owner.token, ...options });
  async function book(quantity = 2, assigned = true) {
    const r = await customer('/orders', {
      method: 'POST',
      body: {
        address: 'Test street 123',
        phone: '9876543210',
        pickupDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        slot: '09:00–12:00',
        items: [{ serviceId: 'wash-fold', quantity }],
      },
    });
    if (r.status !== 201) throw new Error(JSON.stringify(r));
    if (assigned) {
      await db.order.update({
        where: { id: r.data.order.id },
        data: { assigned_to: users.staff.id },
      });
      r.data.order.assigned_to = users.staff.id;
    }
    return r.data.order;
  }
  const action = (order, values = {}) => ({
    eventId: randomUUID(),
    version: order.version,
    ...values,
  });
  async function mutate(order, route, values = {}, actor = staff) {
    if (route === 'assign' && actor === staff) actor = owner;
    const r = await actor(`/orders/${order.id}/${route}`, {
      method: 'POST',
      body: action(order, values),
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(JSON.stringify(r));
    return r.data.order;
  }
  const verify = (response) =>
    request('/auth/verify-email', {
      method: 'POST',
      body: {
        verificationId: response.data.verification.id,
        code: sent.find((message) => message.id === response.data.verification.id).code,
      },
    });
  return {
    db,
    users,
    request,
    customer,
    staff,
    owner,
    book,
    action,
    mutate,
    baseUrl: base,
    sent,
    verify,
  };
}
