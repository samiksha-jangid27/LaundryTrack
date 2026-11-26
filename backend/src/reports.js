import { Router } from 'express';
import { owner } from './auth.js';
export function reportsRouter(db) {
  const router = Router();
  router.get('/issues', async (req, res) => {
    const issues = await db.issue.findMany({
      where: {
        status: 'open',
        ...(req.user.role === 'staff' ? { order: { assigned_to: req.user.id } } : {}),
      },
      orderBy: { created_at: 'asc' },
      take: 100,
      select: {
        id: true,
        category: true,
        message: true,
        created_at: true,
        order: { select: { id: true, number: true, customer: { select: { name: true } } } },
      },
    });
    res.json({ issues });
  });
  router.get('/staff', async (req, res) =>
    res.json({
      staff: await db.user.findMany({
        where: { role: { in: ['staff', 'owner'] }, active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    }),
  );
  router.get('/summary', async (req, res) => {
    const scope = req.user.role === 'owner' ? {} : { assigned_to: req.user.id };
    const [groups, openIssues, garmentCount, openQueries] = await Promise.all([
      db.order.groupBy({
        where: scope,
        by: ['stage'],
        _count: { _all: true },
        _sum: { total: true },
      }),
      db.issue.count({ where: { status: 'open', order: scope } }),
      db.garment.count({ where: { delivered: false, order: scope } }),
      db.ticket.count({
        where: {
          status: { not: 'resolved' },
          ...(req.user.role === 'owner'
            ? {}
            : {
                OR: [
                  { requester_id: req.user.id },
                  { assigned_to: req.user.id, requester_role: 'customer' },
                ],
              }),
        },
      }),
    ]);
    res.json({
      counts: groups.map((row) => ({
        stage: row.stage,
        count: row._count._all,
        total: row._sum.total || 0,
      })),
      openIssues,
      garmentCount,
      openQueries,
    });
  });
  router.get('/export', owner, async (req, res) => {
    const rows = await db.order.findMany({
      select: {
        number: true,
        stage: true,
        pickup_date: true,
        total: true,
        expected_count: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
    res
      .attachment('laundrytrack-orders.csv')
      .type('text/csv')
      .send(
        [
          'Order,Stage,Pickup,Total (paise),Items,Created',
          ...rows.map((row) =>
            [
              row.number,
              row.stage,
              row.pickup_date,
              row.total,
              row.expected_count,
              row.created_at.toISOString(),
            ]
              .map(escape)
              .join(','),
          ),
        ].join('\n'),
      );
  });
  return router;
}
