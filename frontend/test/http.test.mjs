import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBaseUrl, createHttpClient } from '../src/lib/http.js';
import { readSavedSession } from '../src/lib/session-state.js';
import { createRetryRequest } from '../src/lib/retry.js';
import { labelSheet } from '../src/lib/labels.js';

test('API addresses reject credentials, paths and insecure production endpoints', () => {
  assert.equal(normalizeBaseUrl(' https://api.example.com/ '), 'https://api.example.com');
  assert.equal(normalizeBaseUrl('http://10.0.2.2:4000'), 'http://10.0.2.2:4000');
  for (const value of [
    'bad',
    'file:///tmp',
    'https://user:password@example.com',
    'https://example.com/api',
    'https://example.com?token=x',
    'https://example.com#test',
  ])
    assert.throws(() => normalizeBaseUrl(value));
  assert.throws(() => normalizeBaseUrl('http://example.com', { requireHttps: true }));
});

test('transport distinguishes network loss, malformed success and non-JSON server errors', async () => {
  const client = (fetchImpl) =>
    createHttpClient({ getBaseUrl: () => 'https://example.com', getToken: () => null, fetchImpl });
  await assert.rejects(
    client(async () => {
      throw new Error('offline');
    })('/orders'),
    { offline: true },
  );
  await assert.rejects(
    client(async () => new Response('<html>proxy down</html>', { status: 502 }))('/orders'),
    { status: 502, message: /502/ },
  );
  await assert.rejects(
    client(async () => new Response('not json'))('/orders'),
    /valid LaundryTrack response/,
  );
});

test('request timeout covers a stalled response body', async () => {
  const client = createHttpClient({
    getBaseUrl: () => 'https://example.com',
    getToken: () => null,
    timeoutMs: 20,
    fetchImpl: async (_, { signal }) => ({
      status: 200,
      ok: true,
      text: () =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    }),
  });
  await assert.rejects(client('/orders'), { offline: true });
});

test('a late unauthorized response cannot invalidate a new login', async () => {
  let token = 'old';
  let invalidated = false;
  const client = createHttpClient({
    getBaseUrl: () => 'https://example.com',
    getToken: () => token,
    onUnauthorized: () => {
      invalidated = true;
    },
    fetchImpl: async () => {
      token = 'new';
      return new Response('{"error":"Expired"}', { status: 401 });
    },
  });
  await assert.rejects(client('/orders'), { status: 401 });
  assert.equal(invalidated, false);
});

test('a failed login does not trigger session-expiration handling', async () => {
  let invalidations = 0;
  const client = createHttpClient({
    getBaseUrl: () => 'https://example.com',
    getToken: () => null,
    onUnauthorized: () => invalidations++,
    fetchImpl: async () =>
      new Response('{"error":"Email or password is incorrect"}', { status: 401 }),
  });
  await assert.rejects(client('/auth/login', { method: 'POST', body: { password: 'wrong' } }), {
    status: 401,
  });
  assert.equal(invalidations, 0);
});

test('corrupt or incomplete saved sessions are rejected without crashing startup', () => {
  for (const value of ['{', 'null', '{}', '{"token":"abc","user":{}}'])
    assert.equal(readSavedSession(value), null);
  const session = {
    token: 'token',
    user: { id: 'customer', name: 'Name', role: 'customer', emailVerified: true },
    expiresAt: new Date(Date.now() + 10000).toISOString(),
  };
  assert.deepEqual(readSavedSession(JSON.stringify(session)), session);
  const unverified = { ...session, user: { ...session.user, emailVerified: false } };
  assert.deepEqual(readSavedSession(JSON.stringify(unverified)), unverified);
});

test('uncertain action retries retain the original ID and expected version', () => {
  let ids = 0;
  const retry = createRetryRequest(() => String(++ids));
  const first = retry.prepare('same action', { version: 2, type: 'Shirt' });
  assert.deepEqual(retry.prepare('same action', { version: 3, type: 'Shirt' }), first);
  retry.clear();
  assert.equal(retry.prepare('same action', { version: 3 }).eventId, '2');
});

test('an interrupted app restores the complete pending action before retrying', () => {
  let saved = null;
  const storage = {
    load: () => saved,
    save: (value) => {
      saved = value;
    },
  };
  const before = createRetryRequest(() => 'original-id', storage);
  const body = before.prepare('register shirt', { version: 4, type: 'Shirt' });
  const after = createRetryRequest(() => 'must-not-be-used', storage);
  assert.deepEqual(after.prepare('register shirt', { version: 5, type: 'Shirt' }), body);
  after.clear();
  assert.equal(saved, null);
});

test('printable labels escape garment data and accept only inline PNG images', () => {
  const label = {
    color: '<script>alert(1)</script>',
    type: '"shirt"',
    payload: 'laundrytrack:garment:abc',
    image: 'data:image/png;base64,YWJj',
  };
  const html = labelSheet('LT-123', [label]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.throws(() => labelSheet('LT-123', [{ ...label, image: 'javascript:alert(1)' }]));
});
