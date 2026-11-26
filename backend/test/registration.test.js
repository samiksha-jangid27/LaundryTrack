import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
const input = {
  name: 'New customer',
  email: 'new@example.test',
  phone: '9876543210',
  password: 'new-password-123',
};
test('email/password signup works without providers and never claims email ownership is verified', async (t) => {
  const f = await fixture(t);
  const r = await f.request('/auth/register', { method: 'POST', body: input });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  assert.equal(r.data.user.role, 'customer');
  assert.equal(r.data.user.emailVerified, false);
  assert.equal(r.data.verification, undefined);
  const user = await f.db.user.findUnique({ where: { email: input.email } });
  assert.notEqual(user.password_hash, input.password);
  assert.equal(user.email_verified_at, null);
  assert.equal((await f.request('/orders', { token: r.data.token })).status, 200);
  const login = await f.request('/auth/login', {
    method: 'POST',
    body: { email: input.email.toUpperCase(), password: input.password },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, user.id);
  assert.equal((await f.request('/auth/register', { method: 'POST', body: input })).status, 409);
});
test('registration validates email/password and owner can approve a self-registered staff request', async (t) => {
  const f = await fixture(t);
  for (const change of [{ email: 'invalid' }, { password: 'short' }])
    assert.equal(
      (await f.request('/auth/register', { method: 'POST', body: { ...input, ...change } })).status,
      400,
    );
  const r = await f.request('/auth/register', { method: 'POST', body: input });
  assert.equal(
    (await f.request('/auth/staff-request', { method: 'POST', token: r.data.token })).status,
    200,
  );
  const user = await f.db.user.findUnique({ where: { id: r.data.user.id } });
  const approved = await f.owner(`/management/users/${user.id}`, {
    method: 'PATCH',
    body: { version: user.version, role: 'staff' },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.user.role, 'staff');
  assert.equal((await f.request('/auth/me', { token: r.data.token })).status, 401);
  const login = await f.request('/auth/login', {
    method: 'POST',
    body: { email: input.email, password: input.password },
  });
  assert.equal(login.data.user.role, 'staff');
});
test('removed OTP and Google endpoints do not offer a login bypass', async (t) => {
  const f = await fixture(t);
  for (const path of [
    '/auth/google',
    '/auth/google/link',
    '/auth/verify-email',
    '/auth/resend-code',
  ])
    assert.equal((await f.request(path, { method: 'POST', body: {} })).status, 404);
});
test('staff can see and assign a new pickup request; the list retains its assignment', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  assert.equal((await f.staff('/orders')).data.orders[0].stage, 'booked');
  await f.mutate(order, 'assign', { staffId: f.users.staff.id });
  assert.equal((await f.staff('/orders')).data.orders[0].assigned_to, f.users.staff.id);
  assert.equal((await f.customer('/outlet/staff')).status, 403);
});
