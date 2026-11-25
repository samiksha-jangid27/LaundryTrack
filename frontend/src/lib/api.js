import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { normalizeBaseUrl, createHttpClient } from './http';
const fallbackHost =
  Constants.expoConfig?.hostUri?.split(':')[0] ||
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
let baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL || `http://${fallbackHost}:4000`, {
  requireHttps: Constants.expoConfig?.extra?.apiRequiresHttps,
});
let token = null;
let unauthorized;
export const secret = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};
export const setToken = (value) => {
  token = value;
};
export const onUnauthorized = (callback) => {
  unauthorized = callback;
};
export const getBaseUrl = () => baseUrl;
export async function setBaseUrl(value) {
  const next = normalizeBaseUrl(value, {
    requireHttps: Constants.expoConfig?.extra?.apiRequiresHttps,
  });
  await secret.set('laundrytrack.api', next);
  baseUrl = next;
}
export async function restoreBaseUrl() {
  const saved = await secret.get('laundrytrack.api');
  if (saved)
    baseUrl = normalizeBaseUrl(saved, {
      requireHttps: Constants.expoConfig?.extra?.apiRequiresHttps,
    });
}
export const api = createHttpClient({
  getBaseUrl,
  getToken: () => token,
  onUnauthorized: () => unauthorized?.(),
});
