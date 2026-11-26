const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only authenticated inbox records become routes. A push payload cannot supply a URL.
export function notificationDestination(notification, role) {
  const { target_type: type, target_id: id } = notification;
  if (type === 'order' && uuid.test(id || '')) return { pathname: '/order/[id]', params: { id } };
  if (type === 'ticket' && uuid.test(id || ''))
    return { pathname: '/support/[id]', params: { id } };
  if (type === 'management' && role === 'owner') return '/(tabs)/manage';
  if (type === 'account') return '/(tabs)/account';
  if (type === 'orders') return '/(tabs)/orders';
  if (type === 'support') return '/(tabs)/support';
  return '/notifications';
}
export function pushNotificationId(response) {
  const value = response?.notification?.request?.content?.data?.notificationId;
  return typeof value === 'string' && uuid.test(value) ? value : null;
}
