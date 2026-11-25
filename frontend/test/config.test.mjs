import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import appConfig from '../app.config.js';

test('production config requires a hosted HTTPS origin and disables insecure transport', (t) => {
  const previousVariant = process.env.APP_VARIANT;
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  t.after(() => {
    if (previousVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previousVariant;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousUrl;
  });
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url))).expo;
  process.env.APP_VARIANT = 'production';
  delete process.env.EXPO_PUBLIC_API_URL;
  assert.equal(appConfig({ config }).extra.apiUrl, 'https://laundrytrack-1.onrender.com');
  for (const address of [
    '',
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/api',
  ]) {
    process.env.EXPO_PUBLIC_API_URL = address;
    assert.throws(() => appConfig({ config }), /HTTPS server address/);
  }
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  const production = appConfig({ config });
  assert.equal(production.extra.apiUrl, 'https://api.example.com');
  assert.deepEqual(production.platforms, ['android', 'ios']);
  assert.equal(production.extra.apiRequiresHttps, true);
  assert.equal(production.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, undefined);
  const android = production.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  )[1].android;
  assert.equal(android.usesCleartextTraffic, false);
});
