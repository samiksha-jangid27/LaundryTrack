import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { normalizeBaseUrl, createHttpClient } from './http';
const baseUrl = normalizeBaseUrl(Constants.expoConfig?.extra?.apiUrl, {
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
export const api = createHttpClient({
  getBaseUrl: () => baseUrl,
  getToken: () => token,
  onUnauthorized: () => unauthorized?.(),
});
