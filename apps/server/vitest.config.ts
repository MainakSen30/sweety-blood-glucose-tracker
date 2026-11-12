import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'vitest/config';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: resolve(currentDirectory, '../../.env'), quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://sweety_test:sweety@localhost:5432/sweety_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.TEST_DATABASE_URL ??= testDatabaseUrl;
process.env.JWT_SECRET ??= 'test-jwt-secret-value-for-automated-tests-0123456789';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.CLIENT_URL ??= 'http://localhost:5173';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // All suites share one PostgreSQL test database; running them in parallel
    // would let one file's cleanup truncate another file's fixtures.
    fileParallelism: false,
  },
});
