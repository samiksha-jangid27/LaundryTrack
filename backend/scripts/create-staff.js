import { createDatabase } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { registerSchema } from '@laundrytrack/shared';

const role = process.env.STAFF_ROLE || 'staff';
if (!['staff', 'owner'].includes(role)) throw new Error('STAFF_ROLE must be staff or owner');
const input = registerSchema.parse({
  name: process.env.STAFF_NAME,
  email: process.env.STAFF_EMAIL,
  phone: process.env.STAFF_PHONE,
  password: process.env.STAFF_PASSWORD,
});
const db = createDatabase();
try {
  await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      role,
      password_hash: hashPassword(input.password),
    },
  });
  console.log(`Created ${role} account. No credentials were printed.`);
} finally {
  await db.$disconnect();
}
