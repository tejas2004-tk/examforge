import { createApp, startBackgroundJobs } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`ExamForge API listening on http://localhost:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

// Start background jobs if enabled
if (env.NODE_ENV !== 'test') {
  startBackgroundJobs();
}