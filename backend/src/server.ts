import { createApp, startBackgroundJobs } from './app.js';
import { prisma } from './config/database.js';
import { env, isTest } from './config/env.js';
import { closeCache } from './services/cache.service.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`ExamForge API listening on http://localhost:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

// A socket that never finishes its request holds a worker slot open; the timeout
// releases it and surfaces as a 503 rather than an indefinite hang.
server.requestTimeout = env.REQUEST_TIMEOUT_MS;
server.headersTimeout = env.REQUEST_TIMEOUT_MS + 5_000;

if (!isTest) {
  startBackgroundJobs();
}

let shuttingDown = false;

/**
 * Drains in-flight requests before releasing the database and cache handles, so
 * a rolling deploy cannot cut a transaction in half. The timer is the backstop
 * for a connection that refuses to close.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down`);

  const force = setTimeout(() => {
    logger.error('Graceful shutdown timed out, exiting immediately');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  force.unref();

  server.close(async () => {
    try {
      await Promise.allSettled([prisma.$disconnect(), closeCache()]);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown failed', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  void shutdown('uncaughtException');
});

export { app, server };
