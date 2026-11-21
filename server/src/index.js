import { openDatabase, migrate } from './db.js';
import { seedCatalog } from './catalog.js';
import { createApp } from './app.js';
import { seedDemo } from './seed.js';
const db = openDatabase();
migrate(db);
seedCatalog(db);
const demo = process.env.DEMO_MODE === 'true';
if (demo) seedDemo(db);
const port = Number(process.env.PORT) || 4000;
const server = createApp(db, { demo }).listen(port, '0.0.0.0', () =>
  console.log(`LaundryTrack API: http://localhost:${port}${demo ? ' (demo data enabled)' : ''}`),
);
function stop() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
