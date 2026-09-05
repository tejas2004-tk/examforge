import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis is an optional accelerator, never a dependency. When it is absent or
 * unreachable every read misses and every write is dropped, so behaviour is
 * identical apart from latency. A single failure flips the client to a
 * degraded state instead of throwing into request handlers.
 */

let client: Redis | null = null;
let healthy = false;

const connect = (): Redis | null => {
  if (!env.REDIS_ENABLED) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt: number) => Math.min(attempt * 500, 10_000),
  });

  client.on('ready', () => {
    healthy = true;
    logger.info('Redis cache connected');
  });
  client.on('error', (err: Error) => {
    if (healthy) logger.warn('Redis cache unavailable, serving uncached', err.message);
    healthy = false;
  });
  client.on('end', () => {
    healthy = false;
  });

  client.connect().catch((err: Error) => {
    healthy = false;
    logger.warn('Redis cache could not connect, serving uncached', err.message);
  });

  return client;
};

export const initCache = (): void => {
  connect();
};

export const cacheEnabled = (): boolean => env.REDIS_ENABLED && healthy;

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!cacheEnabled() || !client) return null;
  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  if (!cacheEnabled() || !client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // A cache write failure must never surface to the caller.
  }
};

export const cacheDeletePrefix = async (prefix: string): Promise<void> => {
  if (!cacheEnabled() || !client) return;
  try {
    const stream = client.scanStream({ match: `${prefix}*`, count: 200 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) await client.del(...keys);
    }
  } catch {
    // Best effort: stale entries expire on their own TTL.
  }
};

/** Reads through the cache, computing and storing on a miss. */
export const cached = async <T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> => {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  await cacheSet(key, value, ttlSeconds);
  return value;
};

export const cachePing = async (): Promise<'ok' | 'error' | 'disabled'> => {
  if (!env.REDIS_ENABLED) return 'disabled';
  if (!client) return 'error';
  try {
    await client.ping();
    return 'ok';
  } catch {
    return 'error';
  }
};

export const closeCache = async (): Promise<void> => {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = null;
  healthy = false;
};
