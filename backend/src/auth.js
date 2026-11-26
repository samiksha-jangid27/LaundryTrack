import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { Router } from 'express';
import { loginSchema, registerSchema } from '@laundrytrack/shared';
import { HttpError, requireValue } from './errors.js';
import { transaction } from './db.js';
import { notify, ownerIds } from './notifications.js';
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password, stored) {
  const [salt, hex] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  emailVerified: !!u.email_verified_at,
  googleLinked: !!u.google_sub,
  staffRequestedAt: u.staff_requested_at || null,
  staffRequestStatus: u.staff_request_status || null,
});
const DUMMY = hashPassword('not-a-real-password-for-timing');
export function authenticate(db) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return next(new HttpError(401, 'Please sign in', 'unauthenticated'));
    const session = await db.session.findUnique({
      where: { token_hash: digest(token) },
      include: { user: true },
    });
    const user = session && session.expires_at > new Date() ? session.user : null;
    if (!user || !user.active)
      return next(
        new HttpError(401, 'Your session expired. Please sign in again.', 'unauthenticated'),
      );
    req.user = publicUser(user);
    next();
  };
}
export function operator(req, res, next) {
  if (!['staff', 'owner'].includes(req.user.role))
    return next(new HttpError(403, 'Outlet access required'));
  next();
}
export function owner(req, res, next) {
  if (req.user.role !== 'owner') return next(new HttpError(403, 'Owner access required'));
  next();
}
export function authRouter(db) {
  const router = Router();
  const attempts = new Map();
  router.use((req, res, next) => {
    if (req.method !== 'POST' || req.path === '/logout') return next();
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.ip;
    const row = attempts.get(key) || { count: 0, until: now + 900000 };
    if (++row.count > 30)
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    attempts.set(key, row);
    next();
  });
  async function session(res, user) {
    requireValue(user.active, 'This account is suspended. Contact the outlet owner.', 403);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await db.session.deleteMany({ where: { expires_at: { lt: new Date() } } });
    await db.session.create({
      data: { token_hash: digest(token), user_id: user.id, expires_at: expiresAt },
    });
    res.json({ token, expiresAt, user: publicUser(user) });
  }
  router.post('/register', async (req, res) => {
    const input = registerSchema.parse(req.body);
    requireValue(
      !(await db.user.findUnique({ where: { email: input.email } })),
      'An account with that email already exists',
      409,
    );
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: 'customer',
        password_hash: hashPassword(input.password),
      },
    });
    await notify(db, {
      key: `registered:${user.id}`,
      userIds: await ownerIds(db),
      category: 'account',
      title: 'New customer account',
      body: 'A customer registered. View the account in Manage.',
      targetType: 'management',
    });
    res.status(201);
    await session(res, user);
  });
  router.post('/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = checkPassword(input.password, user?.password_hash || DUMMY);
    requireValue(user && valid, 'Email or password is incorrect', 401);
    requireValue(user.active, 'This account is suspended. Contact the outlet owner.', 403);
    await session(res, user);
  });
  router.get('/me', authenticate(db), (req, res) => res.json({ user: req.user }));
  router.patch('/profile', authenticate(db), async (req, res) => {
    const input = registerSchema.pick({ name: true, phone: true }).parse(req.body);
    const user = await transaction(db, async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.user.id },
        data: { ...input, version: { increment: 1 } },
      });
      await tx.accountEvent.create({
        data: {
          target_id: req.user.id,
          actor_id: req.user.id,
          kind: 'profile',
          detail: 'Updated their name or contact number',
        },
      });
      return updated;
    });
    res.json({ user: publicUser(user) });
  });
  router.post('/staff-request', authenticate(db), async (req, res) => {
    requireValue(req.user.role === 'customer', 'This account already has outlet access.', 409);
    const user = await transaction(db, async (tx) => {
      const current = await tx.user.findUnique({ where: { id: req.user.id } });
      if (current.staff_requested_at && current.staff_request_status === 'pending') return current;
      const updated = await tx.user.update({
        where: { id: req.user.id },
        data: {
          staff_requested_at: new Date(),
          staff_request_status: 'pending',
          version: { increment: 1 },
        },
      });
      const entry = await tx.accountEvent.create({
        data: {
          target_id: req.user.id,
          actor_id: req.user.id,
          kind: 'staff_request',
          detail: 'Requested staff access for owner review',
        },
      });
      await notify(tx, {
        key: `account:${entry.id}`,
        userIds: await ownerIds(tx),
        category: 'account',
        title: 'Staff access requested',
        body: 'A customer requested staff access. Review the request in Manage.',
        targetType: 'management',
      });
      return updated;
    });
    res.json({ user: publicUser(user) });
  });
  router.post('/logout', authenticate(db), async (req, res) => {
    await db.session.deleteMany({
      where: { token_hash: digest(req.headers.authorization.slice(7)) },
    });
    res.status(204).end();
  });
  return router;
}
