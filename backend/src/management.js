import { Router } from 'express';
import { z } from 'zod';
import { registerSchema } from '@laundrytrack/shared';
import { transaction } from './db.js';
import { requireValue } from './errors.js';
import { notify, ownerIds } from './notifications.js';

const fields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  version: true,
  email_verified_at: true,
  staff_requested_at: true,
  staff_request_status: true,
  created_at: true,
};
export function managementRouter(db) {
  const router = Router();
  router.get('/users', async (req, res) => {
    const input = z
      .object({
        q: z.string().trim().max(80).default(''),
        role: z.enum(['all', 'customer', 'staff', 'owner']).default('all'),
        state: z.enum(['all', 'active', 'inactive', 'pending']).default('all'),
      })
      .parse(req.query);
    const where = {
      ...(input.role !== 'all' ? { role: input.role } : {}),
      ...(input.state === 'pending'
        ? { staff_requested_at: { not: null }, role: 'customer', active: true }
        : {}),
      ...(['active', 'inactive'].includes(input.state) ? { active: input.state === 'active' } : {}),
      ...(input.q
        ? {
            OR: ['name', 'email', 'phone'].map((key) => ({
              [key]: { contains: input.q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [users, roles, staffRequests] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          ...fields,
          _count: { select: { orders: true, assignments: true, tickets: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      }),
      db.user.groupBy({ by: ['role', 'active'], _count: { _all: true } }),
      db.user.count({
        where: { role: 'customer', active: true, staff_requested_at: { not: null } },
      }),
    ]);
    res.json({ users, roles, staffRequests });
  });
  router.get('/activity', async (req, res) => {
    const activity = await db.accountEvent.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        actor: { select: { name: true } },
        target: { select: { name: true, email: true } },
      },
    });
    res.json({ activity });
  });
  router.patch('/users/:id', async (req, res) => {
    const input = z
      .object({
        version: z.number().int().nonnegative(),
        role: z.enum(['customer', 'staff']).optional(),
        active: z.boolean().optional(),
        name: registerSchema.shape.name.optional(),
        phone: registerSchema.shape.phone.optional(),
        dismissStaffRequest: z.boolean().optional(),
      })
      .parse(req.body);
    const result = await transaction(db, async (tx) => {
      const target = await tx.user.findUnique({ where: { id: req.params.id } });
      requireValue(target, 'Account not found', 404);
      requireValue(
        target.role !== 'owner' && target.id !== req.user.id,
        'Owner accounts cannot be changed here.',
        403,
      );
      requireValue(
        input.role !== 'staff' || target.role === 'staff' || target.email_verified_at,
        'The customer must verify their email before staff approval.',
      );
      const data = {
        ...(input.role
          ? {
              role: input.role,
              staff_requested_at: null,
              staff_request_status: input.role === 'staff' ? 'approved' : null,
            }
          : {}),
        ...(input.dismissStaffRequest
          ? { staff_requested_at: null, staff_request_status: 'declined' }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        version: { increment: 1 },
      };
      const updated = await tx.user.updateMany({
        where: { id: target.id, version: input.version },
        data,
      });
      requireValue(updated.count === 1, 'Account changed. Refresh and try again.', 409);
      let clearedWork = 0;
      if ((input.role && input.role !== target.role) || input.active === false) {
        await tx.session.deleteMany({ where: { user_id: target.id } });
        const orders = await tx.order.findMany({
          where: { assigned_to: target.id, stage: { notIn: ['cancelled', 'delivered'] } },
          select: { id: true },
        });
        await tx.order.updateMany({
          where: { id: { in: orders.map((order) => order.id) } },
          data: { assigned_to: null, version: { increment: 1 }, updated_at: new Date() },
        });
        if (orders.length)
          await tx.event.createMany({
            data: orders.map((order) => ({
              order_id: order.id,
              actor_id: req.user.id,
              kind: 'unassigned',
              description:
                'Assignment cleared after an account change; owner reassignment required',
            })),
          });
        const tickets = await tx.ticket.findMany({
          where: { assigned_to: target.id, status: { not: 'resolved' } },
          select: { id: true },
        });
        clearedWork = orders.length + tickets.length;
        await tx.ticket.updateMany({
          where: { id: { in: tickets.map((ticket) => ticket.id) } },
          data: { assigned_to: null, version: { increment: 1 }, updated_at: new Date() },
        });
        if (tickets.length)
          await tx.ticketMessage.createMany({
            data: tickets.map((ticket) => ({
              ticket_id: ticket.id,
              author_id: req.user.id,
              author_role: 'owner',
              kind: 'system',
              body: 'Assignment cleared after an account change. The owner will reassign this query.',
            })),
          });
      }
      const detail = [
        input.role ? `Role: ${target.role} → ${input.role}` : '',
        input.active !== undefined
          ? input.active
            ? 'Account activated'
            : 'Account suspended'
          : '',
        input.dismissStaffRequest ? 'Staff request declined' : '',
        input.name || input.phone ? 'Profile updated' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const entry = await tx.accountEvent.create({
        data: {
          target_id: target.id,
          actor_id: req.user.id,
          kind: 'account',
          detail: detail || 'Reviewed account',
        },
      });
      await notify(tx, {
        key: `account:${entry.id}`,
        userIds: [target.id],
        category: 'account',
        title: input.dismissStaffRequest
          ? 'Staff request declined'
          : input.role === 'staff'
            ? 'Staff access approved'
            : 'Your account was updated',
        body: detail || 'The owner reviewed your account.',
        targetType: 'account',
      });
      if (clearedWork)
        await notify(tx, {
          key: `reassign:${entry.id}`,
          userIds: await ownerIds(tx),
          category: 'account',
          title: 'Work needs reassignment',
          body: `${clearedWork} active assignments were cleared after an account change. Review orders and queries.`,
          targetType: 'management',
        });
      return tx.user.findUnique({ where: { id: target.id }, select: fields });
    });
    res.json({ user: result });
  });
  return router;
}
