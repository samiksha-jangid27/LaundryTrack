import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { digest } from '../src/auth.js';
import { HttpError } from '../src/errors.js';

const input = {
  name: 'New customer',
  email: 'new@example.test',
  phone: '9876543210',
  password: 'new-password-123',
};
const register = (f) => f.request('/auth/register', { method: 'POST', body: input });

test('signup grants no session until email ownership is proved; codes are single-use and hashed', async (t) => {
  const f = await fixture(t);
  const pending = await register(f);
  assert.equal(pending.status, 202);
  assert.equal(pending.data.token, undefined);
  const user = await f.db.user.findUnique({ where: { email: input.email } });
  assert.equal(user.email_verified_at, null);
  assert.equal(await f.db.session.count({ where: { user_id: user.id } }), 0);
  const code = f.sent[0].code;
  const saved = await f.db.emailVerification.findUnique({
    where: { id: pending.data.verification.id },
  });
  assert.notEqual(saved.code_hash, code);
  assert.ok(!JSON.stringify(pending.data).includes(code));
  const token = randomUUID();
  await f.db.session.create({
    data: { token_hash: digest(token), user_id: user.id, expires_at: new Date(Date.now() + 60000) },
  });
  assert.equal((await f.request('/orders', { token })).status, 401);
  const verified = await f.verify(pending);
  assert.equal(verified.status, 200);
  assert.equal(verified.data.user.emailVerified, true);
  assert.equal((await f.request('/orders', { token: verified.data.token })).status, 200);
  assert.equal((await f.verify(pending)).status, 400);
});

test('verification expires and stops accepting guesses after five failures', async (t) => {
  const f = await fixture(t);
  const pending = await register(f);
  const verificationId = pending.data.verification.id;
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await f.request('/auth/verify-email', {
          method: 'POST',
          body: { verificationId, code: '000000' },
        })
      ).status,
      400,
    );
  assert.equal((await f.verify(pending)).status, 400);
  assert.equal(await f.db.session.count({ where: { user: { email: input.email } } }), 0);
  await f.db.emailVerification.update({
    where: { id: verificationId },
    data: { attempts: 0, expires_at: new Date(0) },
  });
  assert.equal((await f.verify(pending)).status, 400);
});

test('resend has a cooldown and replaces the previous verification code', async (t) => {
  const f = await fixture(t);
  const pending = await register(f);
  const verificationId = pending.data.verification.id;
  const resend = () => f.request('/auth/resend-code', { method: 'POST', body: { verificationId } });
  assert.equal((await resend()).status, 429);
  assert.equal(f.sent.length, 1);
  await f.db.emailVerification.update({
    where: { id: verificationId },
    data: { resend_after: new Date(0) },
  });
  const fresh = await resend();
  assert.equal(fresh.status, 202);
  assert.notEqual(fresh.data.verification.id, verificationId);
  assert.equal((await f.verify(pending)).status, 400);
  assert.equal((await f.verify(fresh)).status, 200);
});

test('email delivery failure leaves the account unverified and never returns a usable session', async (t) => {
  const f = await fixture(t, {
    sendCode: async () => {
      throw new HttpError(503, 'Email unavailable');
    },
  });
  const response = await register(f);
  assert.equal(response.status, 503);
  assert.equal(response.data.token, undefined);
  assert.equal(await f.db.emailVerification.count(), 0);
  assert.equal(await f.db.session.count({ where: { user: { email: input.email } } }), 0);
});

test('Google accepts only a verified identity, creates customers and refuses automatic links to existing verified accounts', async (t) => {
  const good = {
    sub: 'google-subject',
    email: 'google@gmail.com',
    email_verified: true,
    name: 'Google user',
  };
  const f = await fixture(t, {
    google: {
      good,
      unverified: { ...good, email_verified: false },
      owner: { ...good, email: 'owner@test.example' },
    },
  });
  const google = (idToken) =>
    f.request('/auth/google', { method: 'POST', body: { idToken, role: 'owner' } });
  assert.equal((await google('invalid')).status, 401);
  assert.equal((await google('unverified')).status, 401);
  assert.equal((await google('owner')).status, 409);
  const response = await google('good');
  assert.equal(response.status, 200);
  assert.equal(response.data.user.role, 'customer');
  assert.equal(response.data.user.emailVerified, true);
  assert.equal(response.data.user.googleLinked, true);
  assert.equal((await google('good')).data.user.id, response.data.user.id);
});

test('Google account linking requires an authenticated matching email', async (t) => {
  const f = await fixture(t, {
    google: {
      matching: { sub: 'linked-subject', email: 'customer@test.example', email_verified: true },
      other: { sub: 'other-subject', email: 'other@test.example', email_verified: true },
    },
  });
  const link = (idToken, token) =>
    f.request('/auth/google/link', { method: 'POST', token, body: { idToken } });
  assert.equal((await link('matching')).status, 401);
  assert.equal((await link('other', f.users.customer.token)).status, 400);
  assert.equal((await link('matching', f.users.customer.token)).data.user.googleLinked, true);
  assert.equal(
    (await f.request('/auth/google', { method: 'POST', body: { idToken: 'matching' } })).data.user
      .id,
    f.users.customer.id,
  );
});

test('Google identities using a third-party email still need inbox verification', async (t) => {
  const f = await fixture(t, {
    google: {
      thirdParty: {
        sub: 'third-party-subject',
        email: 'thirdparty@example.test',
        email_verified: true,
      },
    },
  });
  const response = await f.request('/auth/google', {
    method: 'POST',
    body: { idToken: 'thirdParty' },
  });
  assert.equal(response.status, 202);
  assert.equal(response.data.token, undefined);
  assert.equal((await f.verify(response)).data.user.emailVerified, true);
});

test('staff can see and assign a new pickup request; the list retains its assignment', async (t) => {
  const f = await fixture(t);
  const order = await f.book();
  assert.equal((await f.staff('/orders')).data.orders[0].stage, 'booked');
  await f.mutate(order, 'assign', { staffId: f.users.staff.id });
  assert.equal((await f.staff('/orders')).data.orders[0].assigned_to, f.users.staff.id);
  assert.equal((await f.customer('/outlet/staff')).status, 403);
});
