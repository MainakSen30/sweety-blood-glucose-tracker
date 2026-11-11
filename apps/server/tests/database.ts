import { Pool } from 'pg';

let testPool: Pool | null = null;

export function requireTestDatabaseUrl(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL is required. Copy .env.example to .env and configure a dedicated test database.',
    );
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive test cleanup against "${databaseName}". Test databases must end with "_test".`,
    );
  }

  return databaseUrl;
}

export function getTestPool(): Pool {
  testPool ??= new Pool({ connectionString: requireTestDatabaseUrl() });
  return testPool;
}

export async function resetUsersTable(): Promise<void> {
  await getTestPool().query('TRUNCATE TABLE users');
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}
