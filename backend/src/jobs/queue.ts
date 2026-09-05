import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Simple in-process background job system.
// In production this would use BullMQ/Redis, but this fallback allows the
// app to run without external dependencies during development.

type JobHandler = (payload: unknown) => Promise<void>;

interface Job {
  id: number;
  type: string;
  payload: unknown;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
}

const handlers = new Map<string, JobHandler>();
let jobQueue: Job[] = [];
let running = false;

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
  logger.info(`Registered job handler: ${type}`);
}

export function scheduleJob(type: string, payload: unknown, delayMs = 0) {
  const job: Job = {
    id: Date.now() + Math.floor(Math.random() * 100000),
    type,
    payload,
    runAt: new Date(Date.now() + delayMs),
    attempts: 0,
    maxAttempts: 3,
  };
  jobQueue.push(job);
  logger.info(`Scheduled job: ${type}`);
  if (!running) void processQueue();
  return job.id;
}

async function processQueue() {
  running = true;
  try {
    while (jobQueue.length > 0) {
      const now = new Date();
      const ready = jobQueue.filter((j) => j.runAt <= now).sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
      if (ready.length === 0) {
        await sleep(1000);
        continue;
      }

      const job = ready[0];
      jobQueue = jobQueue.filter((j) => j.id !== job.id);

      const handler = handlers.get(job.type);
      if (handler) {
        job.attempts += 1;
        try {
          await handler(job.payload);
        } catch (err) {
          logger.error(`Job ${job.type} failed (attempt ${job.attempts}/${job.maxAttempts})`, err);
          if (job.attempts < job.maxAttempts) {
            job.runAt = new Date(Date.now() + Math.pow(2, job.attempts) * 1000);
            jobQueue.push(job);
          } else {
            // Log permanent failure
            await prisma.notification.create({
              data: {
                userId: 'system',
                type: 'SYSTEM',
                title: `Job failed: ${job.type}`,
                message: String(err),
              },
            }).catch(() => {});
          }
        }
      }
    }
  } finally {
    running = false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getQueueStatus() {
  return {
    queued: jobQueue.length,
    running,
    registeredHandlers: Array.from(handlers.keys()),
  };
}