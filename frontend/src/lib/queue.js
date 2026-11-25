import * as Crypto from 'expo-crypto';
import { api } from './api';
import { listPending, addPending, removePending } from './storage';
import { createScanQueue } from './scan-queue';
const queue = createScanQueue({
  listPending,
  addPending,
  removePending,
  makeId: Crypto.randomUUID,
  send: (action) => api(`/orders/${action.orderId}/scan`, { method: 'POST', body: action.body }),
});
export const pendingScans = listPending;
export const scanGarment = queue.scan;
export const syncPending = queue.sync;
