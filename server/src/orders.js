import { randomUUID, randomInt } from 'node:crypto';
import { bookingSchema, bookingTotal, actionSchema } from '@laundrytrack/core';
import { transaction } from './db.js';
import { getCatalog } from './catalog.js';
import { HttpError, requireValue } from './errors.js';
import { digest } from './auth.js';
export const now = () => new Date().toISOString();
export function event(db, orderId, actor, kind, description) {
  db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(
    randomUUID(),
    orderId,
    actor.id,
    kind,
    description,
    now(),
  );
}
export function accessibleOrder(db, id, user) {
  const order = db
    .prepare(
      'SELECT o.*,u.name customer_name FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.id=?',
    )
    .get(id);
  if (!order || (user.role === 'customer' && order.customer_id !== user.id))
    throw new HttpError(404, 'Order not found');
  return order;
}
export function orderDetail(db, id, user) {
  const row = accessibleOrder(db, id, user);
  const { delivery_code_hash, ...order } = row;
  return {
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY rowid').all(id),
    garments: db
      .prepare('SELECT * FROM garments WHERE order_id=? ORDER BY created_at,rowid')
      .all(id),
    events: db
      .prepare(
        'SELECT e.*,u.name actor_name FROM events e JOIN users u ON u.id=e.actor_id WHERE order_id=? ORDER BY e.created_at,e.rowid',
      )
      .all(id),
    issues: db.prepare('SELECT * FROM issues WHERE order_id=? ORDER BY created_at DESC').all(id),
  };
}
export function createOrder(db, user, body) {
  const input = bookingSchema.parse(body);
  const requestHash = digest(JSON.stringify(input));
  if (input.requestId) {
    const replay = db
      .prepare('SELECT * FROM booking_requests WHERE request_id=?')
      .get(input.requestId);
    if (replay) {
      requireValue(
        replay.customer_id === user.id && replay.request_hash === requestHash,
        'This booking request was already used. Check your orders before submitting another.',
        409,
      );
      return JSON.parse(replay.response);
    }
  }
  const day = new Date(`${input.pickupDate}T00:00:00+05:30`);
  const today = new Date(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00+05:30',
  );
  requireValue(
    !Number.isNaN(day.getTime()) && day >= today && day - today <= 14 * 86400000,
    'Choose a pickup date within the next 14 days',
  );
  requireValue(
    new Set(input.items.map((i) => i.serviceId)).size === input.items.length,
    'Combine duplicate services',
  );
  const catalog = getCatalog(db);
  let total;
  try {
    total = bookingTotal(input.items, catalog);
  } catch {
    throw new HttpError(400, 'A selected service is no longer available');
  }
  return transaction(db, () => {
    const id = randomUUID();
    const number = `LT-${randomBytesNumber()}`;
    const date = now();
    const deliveryCode = String(randomInt(100000, 1000000));
    const count = input.items.reduce((n, i) => n + i.quantity, 0);
    db.prepare(
      'INSERT INTO orders(id,number,customer_id,address,phone,pickup_date,slot,notes,total,created_at,updated_at,expected_count,delivery_code_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      number,
      user.id,
      input.address,
      input.phone,
      input.pickupDate,
      input.slot,
      input.notes,
      total,
      date,
      date,
      count,
      digest(deliveryCode),
    );
    for (const item of input.items) {
      const service = catalog.find((s) => s.id === item.serviceId);
      db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?,?)').run(
        randomUUID(),
        id,
        service.id,
        service.name,
        service.unit,
        service.price,
        item.quantity,
      );
    }
    event(db, id, user, 'booked', `Pickup booked for ${input.pickupDate}, ${input.slot}`);
    const result = { ...orderDetail(db, id, user), deliveryCode };
    if (input.requestId)
      db.prepare('INSERT INTO booking_requests VALUES(?,?,?,?)').run(
        input.requestId,
        user.id,
        requestHash,
        JSON.stringify(result),
      );
    return result;
  });
}
function randomBytesNumber() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
}
export function mutateOrder(db, id, user, kind, body, fn) {
  const { eventId, version } = actionSchema.parse(body);
  return transaction(db, () => {
    const order = accessibleOrder(db, id, user);
    const replay = db.prepare('SELECT * FROM actions WHERE event_id=?').get(eventId);
    if (replay) {
      requireValue(
        replay.actor_id === user.id &&
          replay.order_id === id &&
          replay.kind === kind &&
          replay.request_hash === digest(JSON.stringify(body)),
        'Action ID already used',
        409,
      );
      return JSON.parse(replay.response);
    }
    requireValue(order.version === version, 'Order changed. Refresh and try again.', 409);
    const extra = fn(order);
    db.prepare('UPDATE orders SET version=version+1,updated_at=? WHERE id=?').run(now(), id);
    const result = { ...orderDetail(db, id, user), ...(extra || {}) };
    db.prepare(
      'INSERT INTO actions(event_id,actor_id,order_id,kind,response,request_hash) VALUES(?,?,?,?,?,?)',
    ).run(eventId, user.id, id, kind, JSON.stringify(result), digest(JSON.stringify(body)));
    return result;
  });
}
