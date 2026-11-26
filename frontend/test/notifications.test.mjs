import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDestination, pushNotificationId } from '../src/lib/notification-target.js';
const id = '12345678-1234-4234-9234-123456789012';
test('notification navigation accepts only known destinations and valid record IDs', () => {
  assert.deepEqual(notificationDestination({ target_type: 'order', target_id: id }, 'customer'), {
    pathname: '/order/[id]',
    params: { id },
  });
  assert.deepEqual(notificationDestination({ target_type: 'ticket', target_id: id }, 'staff'), {
    pathname: '/support/[id]',
    params: { id },
  });
  assert.equal(notificationDestination({ target_type: 'management' }, 'owner'), '/(tabs)/manage');
  assert.equal(
    notificationDestination({ target_type: 'management' }, 'customer'),
    '/notifications',
  );
  assert.equal(
    notificationDestination({ target_type: 'order', target_id: 'https://example.com' }, 'owner'),
    '/notifications',
  );
  assert.equal(
    notificationDestination({ target_type: 'https://example.com' }, 'owner'),
    '/notifications',
  );
});
test('push taps extract only a valid notification ID; they cannot inject a route or URL', () => {
  const response = (data) => ({ notification: { request: { content: { data } } } });
  assert.equal(
    pushNotificationId(response({ notificationId: id, url: 'https://example.com' })),
    id,
  );
  assert.equal(pushNotificationId(response({ notificationId: { route: '/management' } })), null);
  assert.equal(pushNotificationId(response({ url: '/order/123' })), null);
  assert.equal(pushNotificationId(null), null);
});
