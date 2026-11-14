import { checkDatabaseConnection, closeDatabaseConnection } from './database/index.js';
import { closeRedis } from './cache/redisClient.js';
import {
  REPORT_QUEUE_NAME,
  REPORT_WORKER_CONCURRENCY,
  closeReportQueue,
  createReportWorker,
} from './jobs/reportQueue.js';

/**
 * Dedicated report-generation worker process.
 *
 * Runs independently of the Express HTTP server (own entry point, own npm
 * script, own Compose service) so background report generation never competes
 * with request handling. Importing this file has no side effects; the worker
 * starts only when the script is executed.
 */

const shutdownTimeoutMs = 10_000;

async function startWorker(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log('Report worker connected to PostgreSQL.');
  } catch (error) {
    console.error(
      'Report worker unable to connect to PostgreSQL. Verify DATABASE_URL and ensure the database is running.',
      error,
    );
    await closeDatabaseConnection().catch(() => undefined);
    process.exit(1);
  }

  const worker = createReportWorker();
  console.log(
    `Report worker listening on queue "${REPORT_QUEUE_NAME}" (concurrency ${REPORT_WORKER_CONCURRENCY}).`,
  );

  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Report worker received ${signal}. Draining and closing connections...`);

    const forceExitTimer = setTimeout(() => {
      console.error('Report worker shutdown timed out.');
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExitTimer.unref();

    void (async () => {
      try {
        // Stops picking up new jobs and lets the active job finish before
        // the process exits — no job is abandoned mid-flight.
        await worker.close();
        await closeReportQueue();
        await closeRedis();
        await closeDatabaseConnection();
      } catch (closeError) {
        console.error('Report worker shutdown error:', closeError);
        process.exit(1);
      }

      console.log('Report worker shutdown complete.');
      process.exit(0);
    })();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void startWorker();
