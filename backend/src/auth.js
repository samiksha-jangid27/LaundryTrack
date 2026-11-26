import {
  randomBytes,
  randomUUID,
  randomInt,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, registerSchema } from '@laundrytrack/shared';
import { HttpError, requireValue } from './errors.js';
import { transaction } from './db.js';
import { sendVerificationEmail, verifyGoogleToken } from './identity.js';
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
    if (!user || !user.active || (user.role === 'customer' && !user.email_verified_at))
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
export function authRouter(
  db,
  { sendCode = sendVerificationEmail, verifyGoogle = verifyGoogleToken } = {},
) {
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
  async function challenge(res, user) {
    requireValue(user.active, 'This account is suspended. Contact the outlet owner.', 403);
    const now = new Date();
    const result = await transaction(db, async (tx) => {
      const saved = await tx.emailVerification.findUnique({ where: { user_id: user.id } });
      if (saved && saved.resend_after > now && saved.expires_at > now && saved.attempts < 5)
        return { saved };
      if (saved && saved.resend_after > now)
        throw new HttpError(429, 'Please wait a minute before requesting another code.');
      const code = String(randomInt(100000, 1000000));
      const data = {
        id: randomUUID(),
        code_hash: hashPassword(code),
        expires_at: new Date(now.getTime() + 10 * 60000),
        resend_after: new Date(now.getTime() + 60000),
        attempts: 0,
      };
      return {
        code,
        saved: await tx.emailVerification.upsert({
          where: { user_id: user.id },
          create: { ...data, user_id: user.id },
          update: data,
        }),
      };
    });
    if (result.code) {
      try {
        await sendCode({ email: user.email, code: result.code, id: result.saved.id });
      } catch (error) {
        await db.emailVerification.deleteMany({ where: { id: result.saved.id } });
        throw error;
      }
    }
    res.status(202).json({
      verification: {
        id: result.saved.id,
        email: user.email,
        expiresAt: result.saved.expires_at,
        resendAt: result.saved.resend_after,
      },
      message: 'Enter the code sent to your email to continue.',
    });
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
    await challenge(res, user);
  });
  router.post('/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = checkPassword(input.password, user?.password_hash || DUMMY);
    requireValue(user && valid, 'Email or password is incorrect', 401);
    requireValue(user.active, 'This account is suspended. Contact the outlet owner.', 403);
    if (user.role === 'customer' && !user.email_verified_at) return challenge(res, user);
    await session(res, user);
  });
  router.post('/verify-email', async (req, res) => {
    const input = z
      .object({ verificationId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
      .parse(req.body);
    const saved = await db.emailVerification.findUnique({ where: { id: input.verificationId } });
    requireValue(
      saved && saved.expires_at > new Date() && saved.attempts < 5,
      'This code has expired or was already used. Request a new code.',
    );
    if (!checkPassword(input.code, saved.code_hash)) {
      await db.emailVerification.updateMany({
        where: { id: saved.id, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      throw new HttpError(400, 'That code is incorrect. Please check your email.');
    }
    const user = await transaction(db, async (tx) => {
      const consumed = await tx.emailVerification.deleteMany({
        where: { id: saved.id, attempts: { lt: 5 }, expires_at: { gt: new Date() } },
      });
      requireValue(consumed.count === 1, 'This code has expired or was already used.');
      await tx.session.deleteMany({ where: { user_id: saved.user_id } });
      const updated = await tx.user.update({
        where: { id: saved.user_id },
        data: { email_verified_at: new Date() },
      });
      await notify(tx, {
        key: `verified:${updated.id}`,
        userIds: await ownerIds(tx),
        category: 'account',
        title: 'New verified customer',
        body: 'A customer verified their email. View the account in Manage.',
        targetType: 'management',
      });
      return updated;
    });
    await session(res, user);
  });
  router.post('/resend-code', async (req, res) => {
    const { verificationId } = z.object({ verificationId: z.uuid() }).parse(req.body);
    const saved = await db.emailVerification.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    requireValue(saved && !saved.user.email_verified_at, 'Please sign in to request another code.');
    requireValue(
      saved.resend_after <= new Date(),
      'Please wait a minute before requesting another code.',
      429,
    );
    await challenge(res, saved.user);
  });
  router.post('/google', async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(1).max(10000) }).parse(req.body);
    const identity = await verifyGoogle(idToken);
    requireValue(
      identity?.sub && identity.email_verified === true && identity.email,
      'Google could not verify this account.',
      401,
    );
    const email = identity.email.toLowerCase();
    const authoritativeEmail = email.endsWith('@gmail.com') || !!identity.hd;
    let user = await db.user.findUnique({ where: { google_sub: identity.sub } });
    if (!user) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing && (existing.email_verified_at || existing.role !== 'customer'))
        throw new HttpError(
          409,
          'Sign in with your password first, then connect Google from Account.',
          'account_link_required',
        );
      const data = {
        google_sub: identity.sub,
        email_verified_at: authoritativeEmail ? new Date() : null,
        password_hash: hashPassword(randomBytes(32).toString('hex')),
      };
      user = await transaction(db, async (tx) => {
        let updated;
        if (existing) {
          await tx.session.deleteMany({ where: { user_id: existing.id } });
          await tx.emailVerification.deleteMany({ where: { user_id: existing.id } });
          updated = await tx.user.update({ where: { id: existing.id }, data });
        } else
          updated = await tx.user.create({
            data: {
              ...data,
              email,
              name: (identity.name || email.split('@')[0]).slice(0, 80),
              phone: '',
              role: 'customer',
            },
          });
        if (updated.email_verified_at)
          await notify(tx, {
            key: `verified:${updated.id}`,
            userIds: await ownerIds(tx),
            category: 'account',
            title: 'New verified customer',
            body: 'A customer joined using Google. View the account in Manage.',
            targetType: 'management',
          });
        return updated;
      });
    }
    if (!user.email_verified_at) return challenge(res, user);
    await session(res, user);
  });
  router.post('/google/link', authenticate(db), async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(1).max(10000) }).parse(req.body);
    const identity = await verifyGoogle(idToken);
    requireValue(
      identity?.sub &&
        identity.email_verified === true &&
        identity.email?.toLowerCase() === req.user.email,
      'Choose the Google account with the same email as your LaundryTrack account.',
    );
    const user = await db.user.update({
      where: { id: req.user.id },
      data: {
        google_sub: identity.sub,
        ...(identity.email.toLowerCase().endsWith('@gmail.com') || identity.hd
          ? { email_verified_at: new Date() }
          : {}),
      },
    });
    res.json({ user: publicUser(user) });
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
