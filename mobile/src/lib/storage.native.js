import * as SQLite from 'expo-sqlite';
const db = SQLite.openDatabaseSync('laundrytrack-local.db');
db.execSync(
  'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,order_id TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL);',
);
export const cacheGet = (key) => {
  const row = db.getFirstSync('SELECT value FROM cache WHERE key=?', key);
  return row ? JSON.parse(row.value) : null;
};
export const cacheSet = (key, value) =>
  db.runSync('INSERT OR REPLACE INTO cache VALUES(?,?)', key, JSON.stringify(value));
export const listPending = (userId) =>
  db
    .getAllSync('SELECT payload FROM pending WHERE user_id=? ORDER BY created_at,rowid', userId)
    .map((r) => JSON.parse(r.payload));
export const addPending = (userId, action) =>
  db.runSync(
    'INSERT OR IGNORE INTO pending VALUES(?,?,?,?,?)',
    action.body.eventId,
    userId,
    action.orderId,
    JSON.stringify(action),
    Date.now(),
  );
export const removePending = (id) => db.runSync('DELETE FROM pending WHERE id=?', id);
export const clearLocal = (userId) => {
  db.runSync('DELETE FROM pending WHERE user_id=?', userId);
  db.runSync('DELETE FROM cache WHERE key LIKE ?', `${userId}:%`);
};
