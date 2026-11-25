import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { HttpError } from './errors.js';

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url || !/^postgres(ql)?:\/\//.test(url))
    throw new Error('Set DATABASE_URL to your PostgreSQL connection string in backend/.env.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
}

// A custody update and its retry receipt commit together. Retry PostgreSQL write conflicts.
export async function transaction(db, operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable', timeout: 10000 });
    } catch (error) {
      if (!['P2034', 'P2002'].includes(error.code)) throw error;
      if (attempt === 2)
        throw new HttpError(409, 'Another update is in progress. Refresh and try again.');
    }
  }
}
