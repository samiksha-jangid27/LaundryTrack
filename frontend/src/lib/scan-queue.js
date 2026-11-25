import { flushActions } from './sync.js';

export function createScanQueue({ listPending, addPending, removePending, send, makeId }) {
  let syncing = false;
  return {
    async scan(userId, order, garmentId) {
      const pending = listPending(userId);
      const same = pending.filter((action) => action.orderId === order.id);
      const garment = order.garments.find((item) => item.id === garmentId);
      if (!garment) throw new Error('Wrong order: this garment does not belong in this package.');
      if (garment.packed || same.some((action) => action.body.garmentId === garmentId))
        throw new Error('This garment has already been scanned or queued.');
      if (order.stage !== 'packing') throw new Error('Only an order in packing can accept scans.');
      const version = same.length ? same[0].body.version + same.length : order.version;
      const action = { orderId: order.id, body: { eventId: makeId(), version, garmentId } };
      // Save before transport: interruption or a lost response must retain the request ID.
      addPending(userId, action);
      if (pending.length || syncing) return { queued: true };
      try {
        const result = await send(action);
        removePending(action.body.eventId);
        return { queued: false, ...result };
      } catch (error) {
        if (!error.offline && error.status && error.status < 500) {
          removePending(action.body.eventId);
          throw error;
        }
        return { queued: true };
      }
    },
    async sync(userId) {
      if (syncing)
        return {
          sent: 0,
          remaining: listPending(userId).length,
          error: new Error('Sync is already in progress.'),
        };
      syncing = true;
      try {
        const result = await flushActions({
          actions: listPending(userId),
          send,
          remove: removePending,
        });
        return { ...result, remaining: listPending(userId).length };
      } finally {
        syncing = false;
      }
    },
  };
}
