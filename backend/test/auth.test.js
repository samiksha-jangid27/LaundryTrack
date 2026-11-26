import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
test('sessions require authentication and logout invalidates bearer token', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/orders')).status, 401);
  assert.equal((await f.customer('/auth/me')).data.user.role, 'customer');
  assert.equal((await f.customer('/auth/logout', { method: 'POST' })).status, 204);
  assert.equal((await f.customer('/orders')).status, 401);
});
test('customers cannot read other customers orders or perform outlet work', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  const r = await f.request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Another customer',
      email: 'other@test.example',
      phone: '9876543210',
      password: 'another-password',
    },
  });
  const signedIn = r;
  assert.equal(
    (await f.request(`/orders/${order.id}`, { token: signedIn.data.token })).status,
    404,
  );
  assert.equal(
    (await f.customer(`/orders/${order.id}/advance`, { method: 'POST', body: f.action(order) }))
      .status,
    403,
  );
  assert.equal((await f.customer('/outlet/summary')).status, 403);
});
test('registration cannot self assign staff privileges', async (t) => {
  const f = await fixture(t);
  const r = await f.request('/auth/register', {
    method: 'POST',
    body: {
      name: 'New user',
      email: 'new@test.example',
      phone: '9876543210',
      password: 'another-password',
      role: 'owner',
    },
  });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  assert.equal(r.data.user.role, 'customer');
  assert.ok(!JSON.stringify(r.data).includes('password_hash'));
  assert.equal(
    (
      await f.request('/auth/login', {
        method: 'POST',
        body: { email: 'new@test.example', password: 'wrong' },
      })
    ).status,
    401,
  );
});
