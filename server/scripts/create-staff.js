import { randomUUID } from 'node:crypto';
import { openDatabase, migrate } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { registerSchema } from '@laundrytrack/core';
const role = process.env.STAFF_ROLE || 'staff';
if (!['staff', 'owner'].includes(role)) throw new Error('STAFF_ROLE must be staff or owner');
const input = registerSchema.parse({
  name: process.env.STAFF_NAME,
  email: process.env.STAFF_EMAIL,
  phone: process.env.STAFF_PHONE,
  password: process.env.STAFF_PASSWORD,
});
const db = openDatabase();
migrate(db);
try {
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
    randomUUID(),
    input.name,
    input.email,
    input.phone,
    role,
    hashPassword(input.password),
    new Date().toISOString(),
  );
  console.log(`Created ${role} account. No credentials were printed.`);
} finally {
  db.close();
}
