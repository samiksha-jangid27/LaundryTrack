import { Router } from 'express';
import { z } from 'zod';
import { actionSchema, TICKET_CATEGORIES } from '@laundrytrack/shared';
import { transaction } from './db.js';
import { digest } from './auth.js';
import { accessibleOrder } from './orders.js';
import { requireValue, HttpError } from './errors.js';
import { notifyTicket } from './notifications.js';

export const ticketScope = (user) =>
  user.role === 'owner'
    ? {}
    : {
        OR: [
          { requester_id: user.id },
          ...(user.role === 'staff' ? [{ assigned_to: user.id, requester_role: 'customer' }] : []),
        ],
      };
const related = {
  requester: { select: { id: true, name: true, role: true } },
  assigned: { select: { id: true, name: true } },
  order: { select: { id: true, number: true, customer_id: true, assigned_to: true } },
};
async function accessibleTicket(db, id, user) {
  const ticket = await db.ticket.findFirst({
    where: { id, ...ticketScope(user) },
    include: related,
  });
  if (!ticket) throw new HttpError(404, 'Query not found');
  return ticket;
}
async function detail(db, id, user) {
  const { request_hash, ...ticket } = await accessibleTicket(db, id, user);
  const rows = await db.ticketMessage.findMany({
    where: { ticket_id: id },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: 201,
    select: {
      id: true,
      body: true,
      kind: true,
      author_id: true,
      author_role: true,
      created_at: true,
      author: { select: { name: true } },
    },
  });
  return {
    ...ticket,
    canViewOrder:
      !!ticket.order &&
      (user.role === 'owner' ||
        ticket.order.customer_id === user.id ||
        (user.role === 'staff' && ticket.order.assigned_to === user.id)),
    messages: rows.slice(0, 200).reverse(),
    olderMessages: rows.length > 200,
  };
}
async function actorCurrent(tx, user) {
  const actor = await tx.user.findUnique({ where: { id: user.id } });
  requireValue(
    actor?.active && actor.role === user.role,
    'Your account changed. Please sign in again.',
    401,
  );
}
async function replayed(tx, id, user, ticketId, input) {
  const saved = await tx.ticketMessage.findUnique({ where: { id } });
  if (!saved) return false;
  requireValue(
    saved.ticket_id === ticketId &&
      saved.author_id === user.id &&
      saved.request_hash === digest(JSON.stringify(input)),
    'This action ID was already used.',
    409,
  );
  return true;
}
async function claim(tx, ticket, version, data) {
  const changed = await tx.ticket.updateMany({
    where: { id: ticket.id, version },
    data: { ...data, version: { increment: 1 }, updated_at: new Date() },
  });
  requireValue(changed.count === 1, 'Query changed. Refresh and try again.', 409);
}

export function supportRouter(db) {
  const router = Router();
  const attempts = new Map();
  router.use((req, res, next) => {
    if (!['POST', 'PATCH'].includes(req.method)) return next();
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const row = attempts.get(req.user.id) || { count: 0, until: now + 900000 };
    attempts.set(req.user.id, row);
    if (++row.count > 60)
      return next(new HttpError(429, 'Too many updates. Please try again later.'));
    next();
  });
  router.get('/', async (req, res) => {
    const tickets = await db.ticket.findMany({
      where: ticketScope(req.user),
      orderBy: { updated_at: 'desc' },
      take: 200,
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        version: true,
        requester_id: true,
        requester_role: true,
        assigned_to: true,
        updated_at: true,
        created_at: true,
        ...related,
      },
    });
    res.json({ tickets });
  });
  router.get('/:id', async (req, res) =>
    res.json({ ticket: await detail(db, req.params.id, req.user) }),
  );
  router.post('/', async (req, res) => {
    const input = z
      .object({
        requestId: z.uuid(),
        subject: z.string().trim().min(5).max(120),
        category: z.enum(Object.keys(TICKET_CATEGORIES)),
        message: z.string().trim().min(10).max(2000),
        orderId: z.uuid().optional(),
      })
      .parse(req.body);
    requireValue(
      input.category !== 'operations' || req.user.role !== 'customer',
      'Staff operations is available to outlet staff.',
      403,
    );
    const ticket = await transaction(db, async (tx) => {
      await actorCurrent(tx, req.user);
      const saved = await tx.ticket.findUnique({ where: { id: input.requestId } });
      if (saved) {
        requireValue(
          saved.requester_id === req.user.id &&
            saved.request_hash === digest(JSON.stringify(input)),
          'This request was already used. Check your queries.',
          409,
        );
        return detail(tx, saved.id, req.user);
      }
      if (input.orderId) await accessibleOrder(tx, input.orderId, req.user);
      await tx.ticket.create({
        data: {
          id: input.requestId,
          requester_id: req.user.id,
          requester_role: req.user.role,
          subject: input.subject,
          category: input.category,
          order_id: input.orderId || null,
          request_hash: digest(JSON.stringify(input)),
          messages: {
            create: { author_id: req.user.id, author_role: req.user.role, body: input.message },
          },
        },
      });
      await notifyTicket(tx, input.requestId, input.requestId, req.user, 'New support query');
      return detail(tx, input.requestId, req.user);
    });
    res.status(201).json({ ticket });
  });
  router.post('/:id/messages', async (req, res) => {
    const input = actionSchema
      .extend({ message: z.string().trim().min(1).max(2000) })
      .parse(req.body);
    const ticket = await transaction(db, async (tx) => {
      await actorCurrent(tx, req.user);
      const row = await accessibleTicket(tx, req.params.id, req.user);
      if (await replayed(tx, input.eventId, req.user, row.id, input))
        return detail(tx, row.id, req.user);
      requireValue(
        row.status !== 'resolved' || row.requester_id === req.user.id || req.user.role === 'owner',
        'Reopen this query before replying.',
        409,
      );
      await claim(tx, row, input.version, row.status === 'resolved' ? { status: 'open' } : {});
      await tx.ticketMessage.create({
        data: {
          id: input.eventId,
          ticket_id: row.id,
          author_id: req.user.id,
          author_role: req.user.role,
          body: input.message,
          request_hash: digest(JSON.stringify(input)),
        },
      });
      await notifyTicket(tx, row.id, input.eventId, req.user, 'New reply to your query');
      return detail(tx, row.id, req.user);
    });
    res.status(201).json({ ticket });
  });
  router.patch('/:id', async (req, res) => {
    const input = actionSchema
      .extend({
        status: z.enum(['open', 'in_progress', 'resolved']).optional(),
        assignedTo: z.uuid().nullable().optional(),
      })
      .parse(req.body);
    const ticket = await transaction(db, async (tx) => {
      await actorCurrent(tx, req.user);
      const row = await accessibleTicket(tx, req.params.id, req.user);
      if (await replayed(tx, input.eventId, req.user, row.id, input))
        return detail(tx, row.id, req.user);
      const data = {};
      const notes = [];
      if (input.assignedTo !== undefined) {
        requireValue(req.user.role === 'owner', 'Only the owner can assign queries.', 403);
        if (input.assignedTo) {
          const assignee = await tx.user.findFirst({
            where: {
              id: input.assignedTo,
              active: true,
              role: { in: row.requester_role === 'customer' ? ['staff', 'owner'] : ['owner'] },
            },
          });
          requireValue(
            assignee,
            'Choose an active eligible team member. Staff queries are private to the owner.',
          );
          notes.push(`Assigned to ${assignee.name}`);
        } else notes.push('Assignment removed');
        data.assigned_to = input.assignedTo;
      }
      if (input.status) {
        if (req.user.role !== 'owner' && row.requester_id === req.user.id)
          requireValue(
            ['open', 'resolved'].includes(input.status),
            'The outlet updates work progress.',
            403,
          );
        data.status = input.status;
        notes.push(`Status: ${input.status.replaceAll('_', ' ')}`);
      }
      requireValue(notes.length, 'Choose an assignment or status update.');
      await claim(tx, row, input.version, data);
      await tx.ticketMessage.create({
        data: {
          id: input.eventId,
          ticket_id: row.id,
          author_id: req.user.id,
          author_role: req.user.role,
          kind: 'system',
          body: notes.join(' · '),
          request_hash: digest(JSON.stringify(input)),
        },
      });
      await notifyTicket(
        tx,
        row.id,
        input.eventId,
        req.user,
        input.assignedTo !== undefined
          ? 'Query assignment updated'
          : input.status === 'resolved'
            ? 'Query resolved'
            : 'Query status updated',
        row.assigned_to,
      );
      return detail(tx, row.id, req.user);
    });
    res.json({ ticket });
  });
  return router;
}
