import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter, authenticate, operator, owner } from './auth.js';
import { managementRouter } from './management.js';
import { supportRouter } from './support.js';
import { notificationsRouter } from './notifications.js';
import { orderRouter } from './order-routes.js';
import { reportsRouter } from './reports.js';
import { getCatalog } from './catalog.js';
import { errorHandler } from './errors.js';
export function createApp(db, identityServices) {
  const app = express();
  app.disable('x-powered-by');
  // Set only to the hop count of a trusted reverse proxy when hosting the API.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0)
    throw new Error('TRUST_PROXY_HOPS must be a nonnegative integer');
  if (proxyHops) app.set('trust proxy', proxyHops);
  app.use(
    helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'] } } }),
  );
  const origins = (process.env.WEB_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (req, res) => {
    await db.service.count();
    res.json({ status: 'ok', version: '1.0.0' });
  });
  app.get('/api/services', async (req, res) => res.json({ services: await getCatalog(db) }));
  app.use('/api/auth', authRouter(db, identityServices));
  app.use('/api/orders', authenticate(db), orderRouter(db));
  app.use('/api/outlet', authenticate(db), operator, reportsRouter(db));
  app.use('/api/management', authenticate(db), owner, managementRouter(db));
  app.use('/api/support', authenticate(db), supportRouter(db));
  app.use('/api/notifications', authenticate(db), notificationsRouter(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(errorHandler);
  return app;
}
