import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: resolve(currentDirectory, '../../.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env at the repository root and configure the PostgreSQL connection string.',
  );
}

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
