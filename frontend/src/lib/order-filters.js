export function filterOrders(
  orders,
  { stage = 'active', search = '', mine = false, userId, sort = 'newest' } = {},
) {
  const query = search.trim().toLowerCase();
  return orders
    .filter(
      (order) =>
        (stage === 'all' ||
          (stage === 'active'
            ? !['cancelled', 'delivered'].includes(order.stage)
            : order.stage === stage)) &&
        (!mine || order.assigned_to === userId) &&
        `${order.number} ${order.customer_name || ''} ${order.stage}`.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      if (sort === 'pickup')
        return `${a.pickup_date} ${a.slot}`.localeCompare(`${b.pickup_date} ${b.slot}`);
      if (sort === 'amount') return b.total - a.total;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
}
