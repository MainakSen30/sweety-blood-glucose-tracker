import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(appDirectory, '../..');

function readRootEnvironment(): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(resolve(repositoryRoot, '.env'), 'utf8'));
  } catch {
    return {};
  }
}

export default defineConfig(() => {
  const rootEnvironment = readRootEnvironment();
  const proxyTarget =
    process.env.VITE_API_PROXY_TARGET ??
    rootEnvironment.VITE_API_PROXY_TARGET ??
    'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    // The root .env belongs to the server and Compose. Disabling Vite's env-file
    // loader prevents its NODE_ENV=development from turning build into a dev build.
    envDir: false as const,
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      restoreMocks: true,
    },
  };
});
