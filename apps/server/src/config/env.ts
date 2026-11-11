import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      'DATABASE_URL must be a PostgreSQL connection string (postgres:// or postgresql://)',
    ),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^([1-9]\d*)([smhd])$/, 'JWT_EXPIRES_IN must use a format such as 30m, 1h, or 7d')
    .default('1h'),
});

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error('Invalid environment configuration:');
  console.error(z.prettifyError(parsedEnvironment.error));
  console.error(
    'Copy .env.example to .env at the repository root and fill in the required values.',
  );
  process.exit(1);
}

export const env = parsedEnvironment.data;
