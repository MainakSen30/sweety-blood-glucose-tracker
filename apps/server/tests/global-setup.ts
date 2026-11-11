import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { requireTestDatabaseUrl } from './database.js';

export default async function setupTestDatabase(): Promise<void> {
  const databaseUrl = requireTestDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle(pool);
  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

  try {
    await migrate(database, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
