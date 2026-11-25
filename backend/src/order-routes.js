import { Router } from 'express';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { nextStage, garmentSchema, issueSchema, tagPayload } from '@laundrytrack/shared';
import { estimateOrder } from './estimates.js';
import { operator, digest } from './auth.js';
import { accessibleOrder, createOrder, orderDetail, mutateOrder, event, now } from './orders.js';
import { requireValue, HttpError } from './errors.js';

export function orderRouter(db) {
  const router = Router();
  async function change(req, res, kind, operation, status = 200) {
    const order = await mutateOrder(db, req.params.id, req.user, kind, req.body, operation);
    res.status(status).json({ order });
  }
  router.get('/', async (req, res) => {
    const rows = await db.order.findMany({
      where: req.user.role === 'customer' ? { customer_id: req.user.id } : {},
      orderBy: { sequence: 'desc' },
      take: 500,
      select: {
        id: true,
        number: true,
        stage: true,
        total: true,
        pickup_date: true,
        slot: true,
        expected_count: true,
        collected_count: true,
        created_at: true,
        version: true,
        customer: { select: { name: true } },
        _count: { select: { garments: true } },
        garments: { where: { delivered: true }, select: { id: true } },
      },
    });
    res.json({
      orders: rows.map(({ customer, _count, garments, ...row }) => ({
        ...row,
        customer_name: customer.name,
        garment_count: _count.garments,
        in_care_count: ['booked', 'cancelled', 'delivered'].includes(row.stage)
          ? 0
          : (row.collected_count || 0) - garments.length,
      })),
    });
  });
  router.post('/', async (req, res) => {
    requireValue(req.user.role === 'customer', 'Sign in as a customer to book a pickup', 403);
    res.status(201).json({ order: await createOrder(db, req.user, req.body) });
  });
  router.get('/:id/estimate', async (req, res) =>
    res.json({
      estimate: await estimateOrder(db, await accessibleOrder(db, req.params.id, req.user)),
    }),
  );
  router.get('/:id/labels', operator, async (req, res) => {
    const order = await orderDetail(db, req.params.id, req.user);
    const labels = await Promise.all(
      order.garments.map(async (garment) => ({
        id: garment.id,
        type: garment.type,
        color: garment.color,
        payload: tagPayload(garment.id),
        image: await QRCode.toDataURL(tagPayload(garment.id), {
          margin: 4,
          width: 240,
          errorCorrectionLevel: 'M',
        }),
      })),
    );
    res.json({ labels });
  });
  router.get('/:id', async (req, res) =>
    res.json({ order: await orderDetail(db, req.params.id, req.user) }),
  );
  router.post('/:id/cancel', async (req, res) =>
    change(req, res, 'cancel', async (tx, order) => {
      requireValue(order.stage === 'booked', 'Only uncollected bookings can be cancelled', 409);
      await tx.order.update({ where: { id: order.id }, data: { stage: 'cancelled' } });
      await event(tx, order.id, req.user, 'cancelled', 'Pickup cancelled');
    }),
  );
  router.post('/:id/assign', operator, async (req, res) => {
    const { staffId } = z.object({ staffId: z.uuid() }).parse(req.body);
    const staff = await db.user.findFirst({
      where: { id: staffId, role: { in: ['staff', 'owner'] } },
    });
    requireValue(staff, 'Staff member not found', 404);
    return change(req, res, 'assign', async (tx, order) => {
      requireValue(!['cancelled', 'delivered'].includes(order.stage), 'Order is closed', 409);
      await tx.order.update({ where: { id: order.id }, data: { assigned_to: staff.id } });
      await event(tx, order.id, req.user, 'assigned', `Assigned to ${staff.name}`);
    });
  });
  router.post('/:id/collect', operator, async (req, res) => {
    const { count } = z.object({ count: z.number().int().min(1).max(360) }).parse(req.body);
    return change(req, res, 'collect', async (tx, order) => {
      requireValue(order.stage === 'booked', 'Order has already been collected or cancelled', 409);
      requireValue(
        count === order.expected_count,
        'Pickup count must match the booking. Resolve the discrepancy before accepting custody.',
        409,
      );
      await tx.order.update({
        where: { id: order.id },
        data: { stage: 'collected', collected_count: count },
      });
      await event(
        tx,
        order.id,
        req.user,
        'collected',
        `${count} garments collected; pickup receipt recorded`,
      );
    });
  });
  router.post('/:id/garments', operator, async (req, res) => {
    const input = garmentSchema.parse(req.body);
    return change(req, res, 'intake', async (tx, order) => {
      requireValue(
        order.stage === 'collected',
        'Intake is available after collection and before processing',
        409,
      );
      const count = await tx.garment.count({ where: { order_id: order.id } });
      requireValue(
        count < order.collected_count,
        'All collected garments have already been registered',
        409,
      );
      const garment = await tx.garment.create({ data: { order_id: order.id, ...input } });
      await event(
        tx,
        order.id,
        req.user,
        'intake',
        `${input.color} ${input.type} registered as ${garment.id.slice(0, 8)}`,
      );
    });
  });
  router.post('/:id/advance', operator, async (req, res) =>
    change(req, res, 'advance', async (tx, order) => {
      const next = nextStage(order.stage);
      requireValue(
        next && !['collected', 'delivered'].includes(next),
        'Use pickup or delivery acknowledgement for this step',
        409,
      );
      if (next === 'received') {
        const count = await tx.garment.count({ where: { order_id: order.id } });
        requireValue(
          count === order.collected_count && count > 0,
          'Register every collected garment before accepting intake',
          409,
        );
      }
      if (next === 'ready') {
        const missing = await tx.garment.count({ where: { order_id: order.id, packed: false } });
        requireValue(
          missing === 0,
          'Packing is incomplete. Scan every garment before marking ready.',
          409,
        );
      }
      await tx.order.update({ where: { id: order.id }, data: { stage: next } });
      await event(tx, order.id, req.user, next, `Order moved to ${next.replaceAll('_', ' ')}`);
    }),
  );
  router.post('/:id/scan', operator, async (req, res) => {
    const { garmentId } = z.object({ garmentId: z.uuid() }).parse(req.body);
    return change(req, res, 'scan', async (tx, order) => {
      requireValue(
        order.stage === 'packing',
        'Packing scans are only accepted during packing',
        409,
      );
      const garment = await tx.garment.findUnique({ where: { id: garmentId } });
      requireValue(
        garment && garment.order_id === order.id,
        'Wrong order: this garment does not belong in this package',
        409,
      );
      requireValue(!garment.packed, 'This garment has already been scanned into the package', 409);
      await tx.garment.update({ where: { id: garmentId }, data: { packed: true } });
      await event(
        tx,
        order.id,
        req.user,
        'packed',
        `${garment.color} ${garment.type} verified for packing`,
      );
    });
  });
  router.post('/:id/unpack', operator, async (req, res) => {
    const { garmentId } = z.object({ garmentId: z.uuid() }).parse(req.body);
    return change(req, res, 'unpack', async (tx, order) => {
      requireValue(order.stage === 'packing', 'Only a package being packed can be edited', 409);
      const garment = await tx.garment.findFirst({ where: { id: garmentId, order_id: order.id } });
      requireValue(garment?.packed, 'Garment is not in this package', 409);
      await tx.garment.update({ where: { id: garmentId }, data: { packed: false } });
      await event(
        tx,
        order.id,
        req.user,
        'unpacked',
        `${garment.type} removed from package for recheck`,
      );
    });
  });
  router.post('/:id/delivery-code', async (req, res) => {
    requireValue(
      req.user.role === 'customer',
      'Only the customer can reset the delivery code',
      403,
    );
    const code = String(randomInt(100000, 1000000));
    const result = await mutateOrder(
      db,
      req.params.id,
      req.user,
      'delivery-code',
      req.body,
      async (tx, order) => {
        requireValue(!['cancelled', 'delivered'].includes(order.stage), 'Order is closed', 409);
        await tx.order.update({
          where: { id: order.id },
          data: { delivery_code_hash: digest(code) },
        });
        await event(
          tx,
          order.id,
          req.user,
          'delivery_code',
          'Customer generated a new delivery acknowledgement code',
        );
        return { privateDeliveryCode: code };
      },
    );
    const { privateDeliveryCode, ...order } = result;
    res.json({ order, deliveryCode: privateDeliveryCode });
  });
  router.post('/:id/deliver', operator, async (req, res) => {
    const { code, garmentIds } = z
      .object({ code: z.string().regex(/^\d{6}$/), garmentIds: z.array(z.uuid()).min(1).max(360) })
      .parse(req.body);
    return change(req, res, 'deliver', async (tx, order) => {
      requireValue(order.stage === 'out_for_delivery', 'Order must be out for delivery', 409);
      requireValue(order.delivery_code_hash === digest(code), 'Delivery code is incorrect', 403);
      requireValue(new Set(garmentIds).size === garmentIds.length, 'Select each garment once');
      const valid = await tx.garment.count({
        where: { id: { in: garmentIds }, order_id: order.id, packed: true, delivered: false },
      });
      requireValue(valid === garmentIds.length, 'A selected garment cannot be delivered', 409);
      await tx.garment.updateMany({ where: { id: { in: garmentIds } }, data: { delivered: true } });
      const pending = await tx.garment.count({ where: { order_id: order.id, delivered: false } });
      if (!pending)
        await tx.order.update({
          where: { id: order.id },
          data: { stage: 'delivered', delivered_at: now() },
        });
      await event(
        tx,
        order.id,
        req.user,
        pending ? 'partial_delivery' : 'delivered',
        `${garmentIds.length} garments acknowledged by customer${pending ? `; ${pending} remaining` : ''}`,
      );
    });
  });
  router.post('/:id/issues', async (req, res) => {
    const input = issueSchema.parse(req.body);
    return change(
      req,
      res,
      'issue',
      async (tx, order) => {
        requireValue(req.user.role === 'customer', 'Only customers can raise an issue', 403);
        if (input.garmentId)
          requireValue(
            await tx.garment.findFirst({ where: { id: input.garmentId, order_id: order.id } }),
            'Garment does not belong to this order',
          );
        await tx.issue.create({
          data: {
            order_id: order.id,
            customer_id: req.user.id,
            garment_id: input.garmentId || null,
            category: input.category,
            message: input.message,
          },
        });
        await event(tx, order.id, req.user, 'issue', `Customer reported ${input.category}`);
      },
      201,
    );
  });
  router.post('/:id/issues/:issueId/resolve', operator, async (req, res) => {
    const { resolution } = z
      .object({ resolution: z.string().trim().min(10).max(1000) })
      .parse(req.body);
    return change(req, res, `resolve:${req.params.issueId}`, async (tx, order) => {
      const result = await tx.issue.updateMany({
        where: { id: req.params.issueId, order_id: order.id, status: 'open' },
        data: { status: 'resolved', resolution, resolved_at: now() },
      });
      requireValue(result.count === 1, 'Open issue not found', 404);
      await event(tx, order.id, req.user, 'resolved', 'Outlet responded to a customer issue');
    });
  });
  router.get('/:id/tags/:garmentId', operator, async (req, res) => {
    await accessibleOrder(db, req.params.id, req.user);
    const garment = await db.garment.findFirst({
      where: { id: req.params.garmentId, order_id: req.params.id },
    });
    if (!garment) throw new HttpError(404, 'Garment not found');
    res
      .type('svg')
      .send(
        await QRCode.toString(tagPayload(garment.id), {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
        }),
      );
  });
  return router;
}
