import { Router } from 'express';
import { owner } from './auth.js';
export function reportsRouter(db) {
  const router = Router();
  router.get('/staff', async (req, res) =>
    res.json({
      staff: await db.user.findMany({
        where: { role: { in: ['staff', 'owner'] } },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    }),
  );
  router.get('/summary', async (req, res) => {
    const [groups, openIssues, garmentCount] = await Promise.all([
      db.order.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { total: true } }),
      db.issue.count({ where: { status: 'open' } }),
      db.garment.count({ where: { delivered: false } }),
    ]);
    res.json({
      counts: groups.map((row) => ({
        stage: row.stage,
        count: row._count._all,
        total: row._sum.total || 0,
      })),
      openIssues,
      garmentCount,
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
