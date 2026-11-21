import * as Crypto from 'expo-crypto';
import { api } from './api';
import { listPending, addPending, removePending } from './storage';
import { flushActions } from './sync';
export const pendingScans = (userId) => listPending(userId);
export async function scanGarment(userId, order, garmentId) {
  const pending = listPending(userId);
  const same = pending.filter((a) => a.orderId === order.id);
  const garment = order.garments.find((g) => g.id === garmentId);
  if (!garment) throw new Error('Wrong order: this garment does not belong in this package.');
  if (garment.packed || same.some((a) => a.body.garmentId === garmentId))
    throw new Error('This garment has already been scanned or queued.');
  if (order.stage !== 'packing') throw new Error('Only an order in packing can accept scans.');
  const version = same.length ? same[0].body.version + same.length : order.version;
  const action = { orderId: order.id, body: { eventId: Crypto.randomUUID(), version, garmentId } };
  if (!pending.length) {
    try {
      return {
        queued: false,
        ...(await api(`/orders/${order.id}/scan`, { method: 'POST', body: action.body })),
      };
    } catch (e) {
      if (!e.offline) throw e;
    }
  }
  addPending(userId, action);
  return { queued: true };
}
let syncing = false;
export async function syncPending(userId) {
  if (syncing)
    return {
      sent: 0,
      remaining: listPending(userId).length,
      error: new Error('Sync is already in progress.'),
    };
  syncing = true;
  try {
    return await flushActions({
      actions: listPending(userId),
      send: (a) => api(`/orders/${a.orderId}/scan`, { method: 'POST', body: a.body }),
      remove: removePending,
    });
  } finally {
    syncing = false;
  }
}
