import { estimateOrder } from './estimates.js';
import { Router } from 'express';
import { z } from 'zod';
import { nextStage, garmentSchema, issueSchema } from '@laundrytrack/core';
import { randomUUID, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { tagPayload } from '@laundrytrack/core';
import { operator, digest } from './auth.js';
import { accessibleOrder, createOrder, orderDetail, mutateOrder, event, now } from './orders.js';
import { requireValue, HttpError } from './errors.js';
export function orderRouter(db) {
  const router = Router();
  router.get('/', (req, res) => {
    const where = req.user.role === 'customer' ? 'WHERE o.customer_id=?' : '';
    const rows = db
      .prepare(
        `SELECT o.id,o.number,o.stage,o.total,o.pickup_date,o.slot,o.expected_count,o.created_at,o.version,u.name customer_name,(SELECT COUNT(*) FROM garments g WHERE g.order_id=o.id) garment_count FROM orders o JOIN users u ON u.id=o.customer_id ${where} ORDER BY o.created_at DESC LIMIT 500`,
      )
      .all(...(where ? [req.user.id] : []));
    res.json({ orders: rows });
  });
  router.post('/', (req, res) => {
    requireValue(req.user.role === 'customer', 'Sign in as a customer to book a pickup', 403);
    res.status(201).json({ order: createOrder(db, req.user, req.body) });
  });
  router.get('/:id/estimate', (req, res) =>
    res.json({
      estimate: estimateOrder(db, accessibleOrder(db, req.params.id, req.user), {
        demo: req.app.locals.demo,
      }),
    }),
  );
  router.get('/:id', (req, res) => res.json({ order: orderDetail(db, req.params.id, req.user) }));
  router.post('/:id/cancel', (req, res) =>
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'cancel', req.body, (order) => {
        requireValue(order.stage === 'booked', 'Only uncollected bookings can be cancelled', 409);
        db.prepare("UPDATE orders SET stage='cancelled' WHERE id=?").run(order.id);
        event(db, order.id, req.user, 'cancelled', 'Pickup cancelled');
      }),
    }),
  );
  router.post('/:id/assign', operator, (req, res) => {
    const { staffId } = z.object({ staffId: z.uuid() }).parse(req.body);
    const staff = db
      .prepare("SELECT id,name FROM users WHERE id=? AND role IN ('staff','owner')")
      .get(staffId);
    requireValue(staff, 'Staff member not found', 404);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'assign', req.body, (order) => {
        requireValue(!['cancelled', 'delivered'].includes(order.stage), 'Order is closed', 409);
        db.prepare('UPDATE orders SET assigned_to=? WHERE id=?').run(staff.id, order.id);
        event(db, order.id, req.user, 'assigned', `Assigned to ${staff.name}`);
      }),
    });
  });
  router.post('/:id/collect', operator, (req, res) => {
    const { count } = z.object({ count: z.number().int().min(1).max(360) }).parse(req.body);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'collect', req.body, (order) => {
        requireValue(
          order.stage === 'booked',
          'Order has already been collected or cancelled',
          409,
        );
        requireValue(
          count === order.expected_count,
          'Pickup count must match the booking. Resolve the discrepancy before accepting custody.',
          409,
        );
        db.prepare("UPDATE orders SET stage='collected',collected_count=? WHERE id=?").run(
          count,
          order.id,
        );
        event(
          db,
          order.id,
          req.user,
          'collected',
          `${count} garments collected; pickup receipt recorded`,
        );
      }),
    });
  });
  router.post('/:id/garments', operator, (req, res) => {
    const input = garmentSchema.parse(req.body);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'intake', req.body, (order) => {
        requireValue(
          order.stage === 'collected',
          'Intake is available after collection and before processing',
          409,
        );
        const count = db
          .prepare('SELECT COUNT(*) n FROM garments WHERE order_id=?')
          .get(order.id).n;
        requireValue(
          count < order.collected_count,
          'All collected garments have already been registered',
          409,
        );
        const id = randomUUID();
        db.prepare(
          'INSERT INTO garments(id,order_id,type,color,note,created_at) VALUES(?,?,?,?,?,?)',
        ).run(id, order.id, input.type, input.color, input.note, now());
        event(
          db,
          order.id,
          req.user,
          'intake',
          `${input.color} ${input.type} registered as ${id.slice(0, 8)}`,
        );
      }),
    });
  });
  router.post('/:id/advance', operator, (req, res) =>
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'advance', req.body, (order) => {
        const next = nextStage(order.stage);
        requireValue(
          next && !['collected', 'delivered'].includes(next),
          'Use pickup or delivery acknowledgement for this step',
          409,
        );
        if (next === 'received') {
          const count = db
            .prepare('SELECT COUNT(*) n FROM garments WHERE order_id=?')
            .get(order.id).n;
          requireValue(
            count === order.collected_count && count > 0,
            'Register every collected garment before accepting intake',
            409,
          );
        }
        if (next === 'ready') {
          const missing = db
            .prepare('SELECT COUNT(*) n FROM garments WHERE order_id=? AND packed=0')
            .get(order.id).n;
          requireValue(
            missing === 0,
            'Packing is incomplete. Scan every garment before marking ready.',
            409,
          );
        }
        db.prepare('UPDATE orders SET stage=? WHERE id=?').run(next, order.id);
        event(db, order.id, req.user, next, `Order moved to ${next.replaceAll('_', ' ')}`);
      }),
    }),
  );
  router.post('/:id/scan', operator, (req, res) => {
    const { garmentId } = z.object({ garmentId: z.uuid() }).parse(req.body);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'scan', req.body, (order) => {
        requireValue(
          order.stage === 'packing',
          'Packing scans are only accepted during packing',
          409,
        );
        const garment = db.prepare('SELECT * FROM garments WHERE id=?').get(garmentId);
        requireValue(
          garment && garment.order_id === order.id,
          'Wrong order: this garment does not belong in this package',
          409,
        );
        requireValue(
          !garment.packed,
          'This garment has already been scanned into the package',
          409,
        );
        db.prepare('UPDATE garments SET packed=1 WHERE id=?').run(garmentId);
        event(
          db,
          order.id,
          req.user,
          'packed',
          `${garment.color} ${garment.type} verified for packing`,
        );
      }),
    });
  });
  router.post('/:id/unpack', operator, (req, res) => {
    const { garmentId } = z.object({ garmentId: z.uuid() }).parse(req.body);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'unpack', req.body, (order) => {
        requireValue(order.stage === 'packing', 'Only a package being packed can be edited', 409);
        const g = db
          .prepare('SELECT * FROM garments WHERE id=? AND order_id=?')
          .get(garmentId, order.id);
        requireValue(g?.packed, 'Garment is not in this package', 409);
        db.prepare('UPDATE garments SET packed=0 WHERE id=?').run(garmentId);
        event(db, order.id, req.user, 'unpacked', `${g.type} removed from package for recheck`);
      }),
    });
  });
  router.post('/:id/delivery-code', (req, res) => {
    requireValue(
      req.user.role === 'customer',
      'Only the customer can reset the delivery code',
      403,
    );
    const code = String(randomInt(100000, 1000000));
    const result = mutateOrder(db, req.params.id, req.user, 'delivery-code', req.body, (o) => {
      requireValue(!['cancelled', 'delivered'].includes(o.stage), 'Order is closed', 409);
      db.prepare('UPDATE orders SET delivery_code_hash=? WHERE id=?').run(digest(code), o.id);
      event(
        db,
        o.id,
        req.user,
        'delivery_code',
        'Customer generated a new delivery acknowledgement code',
      );
      return { privateDeliveryCode: code };
    });
    const { privateDeliveryCode, ...order } = result;
    res.json({ order, deliveryCode: privateDeliveryCode });
  });
  router.post('/:id/deliver', operator, (req, res) => {
    const { code, garmentIds } = z
      .object({ code: z.string().regex(/^\d{6}$/), garmentIds: z.array(z.uuid()).min(1).max(360) })
      .parse(req.body);
    res.json({
      order: mutateOrder(db, req.params.id, req.user, 'deliver', req.body, (order) => {
        requireValue(order.stage === 'out_for_delivery', 'Order must be out for delivery', 409);
        requireValue(order.delivery_code_hash === digest(code), 'Delivery code is incorrect', 403);
        requireValue(new Set(garmentIds).size === garmentIds.length, 'Select each garment once');
        for (const id of garmentIds) {
          const g = db
            .prepare('SELECT * FROM garments WHERE id=? AND order_id=?')
            .get(id, order.id);
          requireValue(
            g && g.packed && !g.delivered,
            'A selected garment cannot be delivered',
            409,
          );
        }
        for (const id of garmentIds)
          db.prepare('UPDATE garments SET delivered=1 WHERE id=?').run(id);
        const pending = db
          .prepare('SELECT COUNT(*) n FROM garments WHERE order_id=? AND delivered=0')
          .get(order.id).n;
        if (!pending)
          db.prepare("UPDATE orders SET stage='delivered',delivered_at=? WHERE id=?").run(
            now(),
            order.id,
          );
        event(
          db,
          order.id,
          req.user,
          pending ? 'partial_delivery' : 'delivered',
          `${garmentIds.length} garments acknowledged by customer${pending ? `; ${pending} remaining` : ''}`,
        );
      }),
    });
  });
  router.post('/:id/issues', (req, res) => {
    const input = issueSchema.parse(req.body);
    res.status(201).json({
      order: mutateOrder(db, req.params.id, req.user, 'issue', req.body, (order) => {
        requireValue(req.user.role === 'customer', 'Only customers can raise an issue', 403);
        if (input.garmentId)
          requireValue(
            db
              .prepare('SELECT id FROM garments WHERE id=? AND order_id=?')
              .get(input.garmentId, order.id),
            'Garment does not belong to this order',
          );
        db.prepare(
          'INSERT INTO issues(id,order_id,customer_id,garment_id,category,message,created_at) VALUES(?,?,?,?,?,?,?)',
        ).run(
          randomUUID(),
          order.id,
          req.user.id,
          input.garmentId || null,
          input.category,
          input.message,
          now(),
        );
        event(db, order.id, req.user, 'issue', `Customer reported ${input.category}`);
      }),
    });
  });
  router.post('/:id/issues/:issueId/resolve', operator, (req, res) => {
    const { resolution } = z
      .object({ resolution: z.string().trim().min(10).max(1000) })
      .parse(req.body);
    res.json({
      order: mutateOrder(
        db,
        req.params.id,
        req.user,
        `resolve:${req.params.issueId}`,
        req.body,
        (order) => {
          const result = db
            .prepare(
              "UPDATE issues SET status='resolved',resolution=?,resolved_at=? WHERE id=? AND order_id=? AND status='open'",
            )
            .run(resolution, now(), req.params.issueId, order.id);
          requireValue(result.changes === 1, 'Open issue not found', 404);
          event(db, order.id, req.user, 'resolved', 'Outlet responded to a customer issue');
        },
      ),
    });
  });
  router.get('/:id/tags/:garmentId', operator, async (req, res) => {
    accessibleOrder(db, req.params.id, req.user);
    const g = db
      .prepare('SELECT id FROM garments WHERE id=? AND order_id=?')
      .get(req.params.garmentId, req.params.id);
    if (!g) throw new HttpError(404, 'Garment not found');
    res.type('svg').send(
      await QRCode.toString(tagPayload(g.id), {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    );
  });
  return router;
}
