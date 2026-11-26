import { randomUUID, randomInt } from 'node:crypto';
import { bookingSchema, bookingTotal, actionSchema } from '@laundrytrack/shared';
import { transaction } from './db.js';
import { getCatalog } from './catalog.js';
import { HttpError, requireValue } from './errors.js';
import { digest } from './auth.js';
import { notifyOrder } from './notifications.js';
export const now = () => new Date();

export async function event(db, orderId, actor, kind, description) {
  const entry = await db.event.create({
    data: { order_id: orderId, actor_id: actor.id, kind, description },
  });
  await notifyOrder(db, entry, actor);
  return entry;
}

export async function accessibleOrder(db, id, user) {
  const order = await db.order.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });
  if (
    !order ||
    (user.role !== 'owner' &&
      order.customer_id !== user.id &&
      !(user.role === 'staff' && order.assigned_to === user.id))
  )
    throw new HttpError(404, 'Order not found');
  const { customer, ...row } = order;
  return { ...row, customer_name: customer.name };
}

export async function orderDetail(db, id, user) {
  const { delivery_code_hash, ...order } = await accessibleOrder(db, id, user);
  const [items, garments, events, issues] = await Promise.all([
    db.orderItem.findMany({ where: { order_id: id }, orderBy: { sequence: 'asc' } }),
    db.garment.findMany({ where: { order_id: id }, orderBy: { sequence: 'asc' } }),
    db.event.findMany({
      where: { order_id: id },
      include: { actor: { select: { name: true } } },
      orderBy: { sequence: 'asc' },
    }),
    db.issue.findMany({ where: { order_id: id }, orderBy: { created_at: 'desc' } }),
  ]);
  return {
    ...order,
    items,
    garments,
    issues,
    events: events.map(({ actor, ...entry }) => ({ ...entry, actor_name: actor.name })),
  };
}

export async function createOrder(db, user, body) {
  const input = bookingSchema.parse(body);
  const requestHash = digest(JSON.stringify(input));
  return transaction(db, async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: user.id } });
    requireValue(
      actor?.active && actor.role === user.role,
      'Your account changed. Please sign in again.',
      401,
    );
    if (input.requestId) {
      const replay = await tx.bookingRequest.findUnique({ where: { request_id: input.requestId } });
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
      !Number.isNaN(day.getTime()) &&
        day.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === input.pickupDate &&
        day >= today &&
        day - today <= 14 * 86400000,
      'Choose a pickup date within the next 14 days',
    );
    requireValue(
      new Set(input.items.map((item) => item.serviceId)).size === input.items.length,
      'Combine duplicate services',
    );
    const catalog = await getCatalog(tx);
    let total;
    try {
      total = bookingTotal(input.items, catalog);
    } catch {
      throw new HttpError(400, 'A selected service is no longer available');
    }
    const id = randomUUID();
    const deliveryCode = String(randomInt(100000, 1000000));
    await tx.order.create({
      data: {
        id,
        number: `LT-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
        customer_id: user.id,
        address: input.address,
        phone: input.phone,
        pickup_date: input.pickupDate,
        slot: input.slot,
        notes: input.notes,
        total,
        expected_count: input.items.reduce((count, item) => count + item.quantity, 0),
        delivery_code_hash: digest(deliveryCode),
        items: {
          create: input.items.map((item) => {
            const service = catalog.find((row) => row.id === item.serviceId);
            return {
              service_id: service.id,
              name: service.name,
              unit: service.unit,
              price: service.price,
              quantity: item.quantity,
            };
          }),
        },
      },
    });
    await event(tx, id, user, 'booked', `Pickup booked for ${input.pickupDate}, ${input.slot}`);
    const result = { ...(await orderDetail(tx, id, user)), deliveryCode };
    if (input.requestId)
      await tx.bookingRequest.create({
        data: {
          request_id: input.requestId,
          customer_id: user.id,
          order_id: id,
          request_hash: requestHash,
          response: JSON.stringify(result),
        },
      });
    return result;
  });
}

export function mutateOrder(db, id, user, kind, body, operation) {
  const { eventId, version } = actionSchema.parse(body);
  return transaction(db, async (tx) => {
    const order = await accessibleOrder(tx, id, user);
    const actor = await tx.user.findUnique({ where: { id: user.id } });
    requireValue(
      actor?.active && actor.role === user.role,
      'Your account changed. Please sign in again.',
      401,
    );
    if (!['issue', 'delivery-code', 'cancel'].includes(kind))
      requireValue(
        user.role === 'owner' || (user.role === 'staff' && order.assigned_to === user.id),
        'This work is not assigned to your account.',
        403,
      );
    const replay = await tx.action.findUnique({ where: { event_id: eventId } });
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
    const claimed = await tx.order.updateMany({
      where: { id, version },
      data: { version: { increment: 1 }, updated_at: now() },
    });
    requireValue(claimed.count === 1, 'Order changed. Refresh and try again.', 409);
    const extra = await operation(tx, order);
    const result = { ...(await orderDetail(tx, id, user)), ...(extra || {}) };
    await tx.action.create({
      data: {
        event_id: eventId,
        actor_id: user.id,
        order_id: id,
        kind,
        request_hash: digest(JSON.stringify(body)),
        response: JSON.stringify(result),
      },
    });
    return result;
  });
}
