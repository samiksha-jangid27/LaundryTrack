import { createDatabase } from './db.js';
import { initializeCatalog } from './catalog.js';
import { createApp } from './app.js';

const db = createDatabase();
await db.$connect();
await initializeCatalog(db);
const port = Number(process.env.PORT) || 4000;
const server = createApp(db).listen(port, '0.0.0.0', () =>
  console.log(`LaundryTrack API listening on port ${port}`),
);
function stop() {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
