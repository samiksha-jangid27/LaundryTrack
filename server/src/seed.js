import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hashPassword } from './auth.js';
import { openDatabase, migrate, transaction } from './db.js';
import { seedCatalog } from './catalog.js';
import { createOrder, event, now } from './orders.js';
export const DEMO_PASSWORD = 'FreshStart!2026';
export function seedDemo(db) {
  if (
    db
      .prepare(
        "SELECT COUNT(*) n FROM orders o JOIN users u ON u.id=o.customer_id WHERE u.email='customer@laundrytrack.demo'",
      )
      .get().n >= 5
  )
    return;
  transaction(db, () => {
    for (const [name, email, role] of [
      ['Aarohi', 'customer', 'customer'],
      ['Rohan', 'staff', 'staff'],
      ['Outlet owner', 'owner', 'owner'],
    ])
      db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?,?)').run(
        randomUUID(),
        name,
        `${email}@laundrytrack.demo`,
        '9876543210',
        role,
        hashPassword(DEMO_PASSWORD),
        now(),
      );
  });
  const customer = db.prepare("SELECT * FROM users WHERE email='customer@laundrytrack.demo'").get();
  const staff = db.prepare("SELECT * FROM users WHERE email='staff@laundrytrack.demo'").get();
  const pickupDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  for (const [index, stage] of [
    'cleaning',
    'packing',
    'booked',
    'out_for_delivery',
    'delivered',
  ].entries()) {
    const order = createOrder(db, customer, {
      address: 'Demo address · Maple Residency, Block B',
      phone: '9876543210',
      pickupDate,
      slot: '09:00–12:00',
      notes: index === 0 ? 'Keep the blue shirt on a hanger.' : 'Synthetic demo order',
      items: [{ serviceId: index === 1 ? 'dry-clean' : 'wash-iron', quantity: 3 }],
    });
    transaction(db, () => {
      db.prepare(
        'UPDATE orders SET stage=?,collected_count=?,assigned_to=?,delivery_code_hash=NULL,delivered_at=? WHERE id=?',
      ).run(
        stage,
        stage === 'booked' ? null : 3,
        staff.id,
        stage === 'delivered' ? now() : null,
        order.id,
      );
      if (stage !== 'booked') {
        for (const [i, type] of ['Shirt', 'T-shirt', 'Trousers'].entries())
          db.prepare(
            'INSERT INTO garments(id,order_id,type,color,note,packed,delivered,created_at) VALUES(?,?,?,?,?,?,?,?)',
          ).run(
            randomUUID(),
            order.id,
            type,
            ['Blue', 'White', 'Black'][i],
            '',
            stage === 'out_for_delivery' || stage === 'delivered' ? 1 : 0,
            stage === 'delivered' ? 1 : 0,
            now(),
          );
        event(db, order.id, staff, stage, `Demo order: ${stage.replaceAll('_', ' ')}`);
      }
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDatabase();
  migrate(db);
  seedCatalog(db);
  seedDemo(db);
  db.close();
  console.log(
    'Demo ready. customer / staff / owner @laundrytrack.demo · password: ' + DEMO_PASSWORD,
  );
}
