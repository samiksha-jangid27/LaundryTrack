import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function openDatabase(
  filename = process.env.DATABASE_PATH ||
    fileURLToPath(new URL('../data/laundrytrack.sqlite', import.meta.url)),
) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function migrate(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,phone TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('customer','staff','owner')),password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,unit TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),hours INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,customer_id TEXT NOT NULL REFERENCES users(id),stage TEXT NOT NULL DEFAULT 'booked',address TEXT NOT NULL,phone TEXT NOT NULL,pickup_date TEXT NOT NULL,slot TEXT NOT NULL,notes TEXT NOT NULL,total INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,assigned_to TEXT REFERENCES users(id),expected_count INTEGER NOT NULL,collected_count INTEGER,delivery_code_hash TEXT,delivered_at TEXT);
CREATE TABLE IF NOT EXISTS order_items(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),service_id TEXT NOT NULL REFERENCES services(id),name TEXT NOT NULL,unit TEXT NOT NULL,price INTEGER NOT NULL,quantity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS garments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),type TEXT NOT NULL,color TEXT NOT NULL,note TEXT NOT NULL,packed INTEGER NOT NULL DEFAULT 0,delivered INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),actor_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,description TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS actions(event_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,order_id TEXT NOT NULL,kind TEXT NOT NULL,response TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),customer_id TEXT NOT NULL REFERENCES users(id),garment_id TEXT REFERENCES garments(id),category TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',resolution TEXT,created_at TEXT NOT NULL,resolved_at TEXT);
CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id,created_at);
CREATE INDEX IF NOT EXISTS events_order ON events(order_id,created_at);
CREATE INDEX IF NOT EXISTS garments_order ON garments(order_id);
CREATE TABLE IF NOT EXISTS booking_requests(request_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES users(id),request_hash TEXT NOT NULL,response TEXT NOT NULL);
`);
  if (
    !db
      .prepare('PRAGMA table_info(actions)')
      .all()
      .some((c) => c.name === 'request_hash')
  )
    db.exec('ALTER TABLE actions ADD COLUMN request_hash TEXT');
  db.exec('PRAGMA user_version = 2');
}
