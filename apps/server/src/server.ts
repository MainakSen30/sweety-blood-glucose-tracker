import type { Server } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, closeDatabaseConnection } from './database/index.js';
import { closeRedis } from './cache/redisClient.js';
import { closeReportQueue } from './jobs/reportQueue.js';

const shutdownTimeoutMs = 10_000;

async function startServer(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log('PostgreSQL connection established.');
  } catch (error) {
    console.error(
      'Unable to connect to PostgreSQL. Verify DATABASE_URL and ensure the database is running.',
      error,
    );
    await closeDatabaseConnection().catch(() => undefined);
    process.exit(1);
  }

  const server: Server = app.listen(env.PORT, () => {
    console.log(`Sweety API listening on http://localhost:${env.PORT} (${env.NODE_ENV}).`);
  });

  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Closing server and database connections...`);

    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExitTimer.unref();

    server.close((error) => {
      void (async () => {
        try {
          await closeDatabaseConnection();
          await closeRedis();
          await closeReportQueue();
        } catch (closeError) {
          console.error('Failed to close the PostgreSQL pool:', closeError);
        }

        if (error) {
          console.error('Failed to close the HTTP server:', error);
          process.exit(1);
        }

        console.log('Shutdown complete.');
        process.exit(0);
      })();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void startServer();
