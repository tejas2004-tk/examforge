import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';
import { metricsMiddleware } from './monitoring/metrics.js';
import registerJobs from './jobs/index.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );

  // Structured request logging + metrics
  app.use(metricsMiddleware);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startBackgroundJobs() {
  try {
    registerJobs();
  } catch (err) {
    console.error('Failed to start background jobs:', err);
  }
}