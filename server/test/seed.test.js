import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, migrate } from '../src/db.js';
import { seedCatalog } from '../src/catalog.js';
import { seedDemo } from '../src/seed.js';
test('demo seeding is atomic if a garment insert fails, and retry creates exactly five orders', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  migrate(db);
  seedCatalog(db);
  db.exec(
    "CREATE TRIGGER fail_garment BEFORE INSERT ON garments BEGIN SELECT RAISE(ABORT,'simulated write failure'); END",
  );
  assert.throws(() => seedDemo(db), /simulated write failure/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
  db.exec('DROP TRIGGER fail_garment');
  seedDemo(db);
  seedDemo(db);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, 5);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 3);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM garments').get().n, 12);
});
