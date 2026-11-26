import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { api, secret } from './api';

let modulePromise;
export async function pushModule() {
  if (isRunningInExpoGo())
    throw new Error(
      'Phone alerts need the installed LaundryTrack app. Your inbox works in Expo Go.',
    );
  if (!['android', 'ios'].includes(Platform.OS))
    throw new Error('Phone alerts are available on Android and iOS.');
  if (!modulePromise)
    modulePromise = import('expo-notifications').then((notifications) => {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      return notifications;
    });
  return modulePromise;
}

export async function syncPushDevice(requestPermission = false) {
  const notifications = await pushModule();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId)
    throw new Error('Phone alerts are awaiting setup by the outlet. Your in-app inbox is ready.');
  if (Platform.OS === 'android')
    await notifications.setNotificationChannelAsync('updates', {
      name: 'Laundry updates',
      importance: notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: '#007F75',
      sound: 'default',
    });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission)
    permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (!requestPermission) return false;
    throw new Error(
      'Allow notifications in your phone settings to receive alerts. Your inbox will keep every update.',
    );
  }
  const token = await notifications.getExpoPushTokenAsync({ projectId });
  let installationId = await secret.get('laundrytrack.installation');
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await secret.set('laundrytrack.installation', installationId);
  }
  await api('/notifications/devices', {
    method: 'PUT',
    body: { installationId, token: token.data, platform: Platform.OS },
  });
  return true;
}

export async function unregisterPushDevice() {
  const id = await secret.get('laundrytrack.installation');
  if (id) await api(`/notifications/devices/${id}`, { method: 'DELETE' });
}
