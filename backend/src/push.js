const EXPO_URL = 'https://exp.host/--/api/v2/push/';
const RECEIPT_DELAY = 15 * 60000;
const MAX_AGE = 24 * 60 * 60000;
const retryable = (code) => ['transport', 'MessageRateExceeded', 'ExpoUnavailable'].includes(code);
const backoff = (attempt) => Math.min(3600000, 10000 * 2 ** Math.min(attempt, 9));

// Kept injectable so tests never contact Expo or send messages to a real phone.
export function expoTransport(fetcher = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN) {
  async function post(path, body) {
    const response = await fetcher(EXPO_URL + path, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error('Push provider request failed');
      error.code = response.status === 429 || response.status >= 500 ? 'transport' : 'ExpoRejected';
      throw error;
    }
    const result = await response.json();
    if (result.errors?.length || !result.data) {
      const error = new Error('Push provider rejected the request');
      error.code = 'ExpoRejected';
      throw error;
    }
    return result.data;
  }
  return {
    send: (messages) => post('send', messages),
    receipts: (ids) => post('getReceipts', { ids }),
  };
}

// next_attempt is also a two-minute lease. Multiple API instances can share this durable outbox.
export async function deliverPushBatch(db, transport = expoTransport(), clock = () => new Date()) {
  const now = clock();
  const due = await db.pushDelivery.findMany({
    where: { state: { in: ['pending', 'ticket'] }, next_attempt: { lte: now } },
    orderBy: { next_attempt: 'asc' },
    take: 50,
    select: { id: true, state: true },
  });
  const claimed = [];
  for (const item of due) {
    const lease = await db.pushDelivery.updateMany({
      where: { id: item.id, state: item.state, next_attempt: { lte: now } },
      data: { next_attempt: new Date(now.getTime() + 120000) },
    });
    if (lease.count) claimed.push(item.id);
  }
  if (!claimed.length) return;
  const rows = await db.pushDelivery.findMany({
    where: { id: { in: claimed } },
    include: { notification: { include: { user: true } }, device: true },
  });
  const update = (id, data) => db.pushDelivery.updateMany({ where: { id }, data });
  async function failure(row, code, receipt = false) {
    if (code === 'DeviceNotRegistered')
      await db.pushDevice.updateMany({
        where: { id: row.device_id, expo_token: row.device.expo_token },
        data: { enabled: false },
      });
    const retry = retryable(code) && row.attempts < 8 && now - row.created_at < MAX_AGE;
    await update(row.id, {
      state: retry ? (receipt && code === 'transport' ? 'ticket' : 'pending') : 'failed',
      last_error: code,
      attempts: { increment: 1 },
      next_attempt: new Date(now.getTime() + backoff(row.attempts)),
      ...(retry && !(receipt && code === 'transport') ? { ticket_id: null } : {}),
    });
  }
  const ready = [];
  for (const row of rows) {
    const { notification: note, device } = row;
    if (
      note.user_id !== device.user_id ||
      !device.enabled ||
      !note.user.active ||
      !note.user.push_enabled ||
      note.read_at
    ) {
      await update(row.id, { state: 'skipped' });
    } else if (now - row.created_at >= MAX_AGE) {
      await update(row.id, { state: 'failed', last_error: 'Expired' });
    } else ready.push(row);
  }
  const pending = ready.filter((row) => row.state === 'pending');
  if (pending.length) {
    let tickets;
    try {
      tickets = await transport.send(
        pending.map((row) => ({
          to: row.device.expo_token,
          title: 'LaundryTrack',
          body: 'You have a new update. Open LaundryTrack for details.',
          sound: 'default',
          channelId: 'updates',
          data: { notificationId: row.notification_id },
          ttl: 86400,
        })),
      );
    } catch (error) {
      for (const row of pending) await failure(row, error.code || 'transport');
    }
    if (tickets)
      for (const [index, row] of pending.entries()) {
        const ticket = tickets[index];
        if (ticket?.status === 'ok' && typeof ticket.id === 'string')
          await update(row.id, {
            state: 'ticket',
            ticket_id: ticket.id,
            attempts: { increment: 1 },
            last_error: null,
            next_attempt: new Date(now.getTime() + RECEIPT_DELAY),
          });
        else await failure(row, ticket?.details?.error || 'ExpoRejected');
      }
  }
  const waiting = ready.filter((row) => row.state === 'ticket' && row.ticket_id);
  if (waiting.length) {
    let receipts;
    try {
      receipts = await transport.receipts(waiting.map((row) => row.ticket_id));
    } catch (error) {
      for (const row of waiting) await failure(row, error.code || 'transport', true);
    }
    if (receipts)
      for (const row of waiting) {
        const receipt = receipts[row.ticket_id];
        if (!receipt)
          await update(row.id, { next_attempt: new Date(now.getTime() + RECEIPT_DELAY) });
        else if (receipt.status === 'ok')
          await update(row.id, { state: 'delivered', last_error: null });
        else await failure(row, receipt.details?.error || 'ExpoRejected', true);
      }
  }
}

export function startPushWorker(db) {
  let active = null;
  const run = () => {
    if (active) return;
    active = deliverPushBatch(db)
      .catch(() => console.error('Push outbox check failed; it will retry.'))
      .finally(() => {
        active = null;
      });
  };
  const timer = setInterval(run, 10000);
  timer.unref();
  run();
  return async () => {
    clearInterval(timer);
    await active;
  };
}
