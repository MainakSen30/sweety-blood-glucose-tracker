import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://sweety:sweety@localhost:5432/sweety_test',
    },
  },
});
