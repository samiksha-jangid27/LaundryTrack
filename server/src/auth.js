import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { Router } from 'express';
import { loginSchema, registerSchema } from '@laundrytrack/core';
import { HttpError, requireValue } from './errors.js';
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
});
const DUMMY = hashPassword('not-a-real-password-for-timing');
export function authenticate(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return next(new HttpError(401, 'Please sign in', 'unauthenticated'));
    const user = db
      .prepare(
        'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',
      )
      .get(digest(token), new Date().toISOString());
    if (!user)
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
    if (!['/login', '/register'].includes(req.path) || req.method !== 'POST') return next();
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.ip;
    const row = attempts.get(key) || { count: 0, until: now + 900000 };
    if (++row.count > 30)
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    attempts.set(key, row);
    next();
  });
  function session(res, user) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(new Date().toISOString());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user.id, expiresAt);
    res.json({ token, expiresAt, user: publicUser(user) });
  }
  router.post('/register', (req, res) => {
    const input = registerSchema.parse(req.body);
    requireValue(
      !db.prepare('SELECT id FROM users WHERE email=?').get(input.email),
      'An account with that email already exists',
      409,
    );
    const user = { id: randomUUID(), ...input, role: 'customer' };
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role,
      hashPassword(input.password),
      new Date().toISOString(),
    );
    session(res, user);
  });
  router.post('/login', (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
    const valid = checkPassword(input.password, user?.password_hash || DUMMY);
    requireValue(user && valid, 'Email or password is incorrect', 401);
    session(res, user);
  });
  router.get('/me', authenticate(db), (req, res) => res.json({ user: req.user }));
  router.post('/logout', authenticate(db), (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(
      digest(req.headers.authorization.slice(7)),
    );
    res.status(204).end();
  });
  return router;
}
