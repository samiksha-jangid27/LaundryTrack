import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { requireValue } from './errors.js';

export async function ownerIds(db) {
  const users = await db.user.findMany({
    where: { role: 'owner', active: true },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

// Call inside the domain transaction: failed actions and retries cannot create extra alerts.
export async function notify(
  db,
  { key, userIds, excludeId, category, title, body, targetType, targetId },
) {
  const recipients = await db.user.findMany({
    where: { id: { in: [...new Set(userIds.filter((id) => id && id !== excludeId))] } },
    select: { id: true, push_enabled: true, active: true },
  });
  if (!recipients.length) return;
  const rows = await db.notification.createManyAndReturn({
    skipDuplicates: true,
    data: recipients.map((user) => ({
      user_id: user.id,
      event_key: key,
      category,
      title,
      body,
      target_type: targetType,
      target_id: targetId || null,
    })),
  });
  if (!rows.length) return;
  const devices = await db.pushDevice.findMany({
    where: {
      user_id: {
        in: recipients.filter((user) => user.push_enabled && user.active).map((user) => user.id),
      },
      enabled: true,
    },
  });
  const deliveries = rows.flatMap((row) =>
    devices
      .filter((device) => device.user_id === row.user_id)
      .map((device) => ({ notification_id: row.id, device_id: device.id })),
  );
  if (deliveries.length)
    await db.pushDelivery.createMany({ data: deliveries, skipDuplicates: true });
}

const orderTitles = {
  booked: 'Pickup booked',
  assigned: 'Pickup assignment updated',
  collected: 'Pickup complete',
  received: 'Garments checked in',
  cleaning: 'Freshness in progress',
  quality_check: 'Quality check started',
  packing: 'Your laundry is being packed',
  ready: 'Fresh laundry, ready to go',
  out_for_delivery: 'Laundry on its way',
  delivered: 'Delivery complete',
  partial_delivery: 'Delivery update',
  cancelled: 'Pickup cancelled',
  issue: 'A garment issue needs attention',
  resolved: 'Garment issue updated',
};
export async function notifyOrder(db, event, actor) {
  const title = orderTitles[event.kind];
  if (!title) return; // Individual intake/scans and private delivery-code resets stay in the order history.
  const order = await db.order.findUnique({ where: { id: event.order_id } });
  await notify(db, {
    key: `order:${event.id}`,
    userIds: [order.customer_id, order.assigned_to, ...(await ownerIds(db))],
    excludeId: event.kind === 'booked' ? undefined : actor.id,
    category: 'order',
    title,
    body: `${order.number} · Open your order for the latest details.`,
    targetType: 'order',
    targetId: order.id,
  });
}

export async function notifyTicket(db, ticketId, key, actor, title, previousAssignee) {
  const row = await db.ticket.findUnique({ where: { id: ticketId } });
  // Staff requests remain private even if the requester later becomes a customer.
  const assignee = row.requester_role === 'customer' ? row.assigned_to : null;
  await notify(db, {
    key: `query:${key}`,
    userIds: [row.requester_id, assignee, ...(await ownerIds(db))],
    excludeId: actor.id,
    category: 'support',
    title,
    body: 'Your support conversation has an update. Open it to view the details.',
    targetType: 'ticket',
    targetId: ticketId,
  });
  if (previousAssignee && previousAssignee !== row.assigned_to)
    await notify(db, {
      key: `query-unassigned:${key}`,
      userIds: [previousAssignee],
      excludeId: actor.id,
      category: 'support',
      title: 'Query assignment removed',
      body: 'A query has been removed from your work queue.',
      targetType: 'support',
    });
}

const deviceSchema = z.object({
  installationId: z.uuid(),
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/),
  platform: z.enum(['android', 'ios']),
});
export function notificationsRouter(db) {
  const router = Router();
  router.get('/summary', async (req, res) => {
    const [unread, user] = await Promise.all([
      db.notification.count({ where: { user_id: req.user.id, read_at: null } }),
      db.user.findUnique({ where: { id: req.user.id }, select: { push_enabled: true } }),
    ]);
    res.json({ unread, pushEnabled: user.push_enabled });
  });
  router.get('/', async (req, res) => {
    const { filter, before } = z
      .object({
        filter: z.enum(['all', 'unread']).default('all'),
        before: z.uuid().optional(),
      })
      .parse(req.query);
    const cursor = before
      ? await db.notification.findFirst({ where: { id: before, user_id: req.user.id } })
      : null;
    requireValue(!before || cursor, 'Notification not found', 404);
    const rows = await db.notification.findMany({
      where: {
        user_id: req.user.id,
        ...(filter === 'unread' ? { read_at: null } : {}),
        ...(cursor
          ? {
              OR: [
                { created_at: { lt: cursor.created_at } },
                { created_at: cursor.created_at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 51,
      omit: { event_key: true },
    });
    res.json({
      notifications: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    });
  });
  router.patch('/read-all', async (req, res) => {
    // A cutoff avoids marking an alert that arrived after the inbox was opened as read.
    const { through } = z.object({ through: z.iso.datetime() }).parse(req.body);
    await db.notification.updateMany({
      where: { user_id: req.user.id, read_at: null, created_at: { lte: new Date(through) } },
      data: { read_at: new Date() },
    });
    res.status(204).end();
  });
  router.patch('/preferences', async (req, res) => {
    const { pushEnabled } = z.object({ pushEnabled: z.boolean() }).parse(req.body);
    await db.user.update({ where: { id: req.user.id }, data: { push_enabled: pushEnabled } });
    res.json({ pushEnabled });
  });
  router.put('/devices', async (req, res) => {
    const input = deviceSchema.parse(req.body);
    await transaction(db, async (tx) => {
      // Shared phones must never deliver a previous account's queued notification to the next user.
      await tx.pushDevice.deleteMany({
        where: {
          OR: [
            { id: input.installationId, user_id: { not: req.user.id } },
            { expo_token: input.token, id: { not: input.installationId } },
          ],
        },
      });
      const data = {
        user_id: req.user.id,
        expo_token: input.token,
        platform: input.platform,
        enabled: true,
        updated_at: new Date(),
      };
      await tx.pushDevice.upsert({
        where: { id: input.installationId },
        create: { id: input.installationId, ...data },
        update: data,
      });
    });
    res.status(204).end();
  });
  router.delete('/devices/:id', async (req, res) => {
    await db.pushDevice.deleteMany({ where: { id: req.params.id, user_id: req.user.id } });
    res.status(204).end();
  });
  router.patch('/:id/read', async (req, res) => {
    const result = await db.notification.updateMany({
      where: { id: req.params.id, user_id: req.user.id },
      data: { read_at: new Date() },
    });
    requireValue(result.count, 'Notification not found', 404);
    res.status(204).end();
  });
  router.get('/:id', async (req, res) => {
    const notification = await db.notification.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
      omit: { event_key: true },
    });
    requireValue(notification, 'Notification not found', 404);
    res.json({ notification });
  });
  return router;
}
