export const catalog = [
  {
    id: 'wash-fold',
    name: 'Wash & fold',
    description: 'Everyday cottons, washed separately per order and neatly folded.',
    unit: 'item',
    price: 3500,
    hours: 48,
  },
  {
    id: 'wash-iron',
    name: 'Wash & iron',
    description: 'A fresh wash and a crisp finish for your weekly wardrobe.',
    unit: 'item',
    price: 5500,
    hours: 48,
  },
  {
    id: 'steam-iron',
    name: 'Steam iron',
    description: 'Gentle steam pressing for clean garments.',
    unit: 'item',
    price: 2000,
    hours: 24,
  },
  {
    id: 'dry-clean',
    name: 'Dry cleaning',
    description: 'Specialist care for suits, dresses and delicate fabrics.',
    unit: 'item',
    price: 18000,
    hours: 72,
  },
  {
    id: 'linen',
    name: 'Bed & bath',
    description: 'Fresh care for single bedsheets and standard bath towels.',
    unit: 'item',
    price: 9000,
    hours: 48,
  },
];
export async function initializeCatalog(db) {
  await db.service.createMany({ data: catalog, skipDuplicates: true });
}
export function getCatalog(db) {
  return db.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
}
