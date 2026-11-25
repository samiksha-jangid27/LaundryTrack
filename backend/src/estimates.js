export async function estimateOrder(db, order) {
  const items = await db.orderItem.findMany({
    where: { order_id: order.id },
    include: { service: true },
  });
  return {
    hours: Math.max(...items.map((item) => item.service.hours)),
    method: 'Service estimate',
    detail: 'Based on the selected service. Outlet workload and fabric care may change timing.',
    source: 'catalog',
  };
}
