import { AsyncLocalStorage } from 'node:async_hooks';
import { isProduction } from '../config/env.js';

export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  userId?: string;
}

/**
 * Carries the request id through service and repository layers so a log line
 * written deep in the stack can be matched to the response the client saw.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentRequestId = (): string | undefined => requestContext.getStore()?.requestId;

type Level = 'debug' | 'info' | 'warn' | 'error';

const serialise = (value: unknown): unknown => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
};

const emit = (level: Level, args: unknown[]) => {
  const store = requestContext.getStore();
  const message = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(serialise(a))))
    .join(' ');

  if (isProduction) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...(store ? { requestId: store.requestId, userId: store.userId, path: store.path } : {}),
    });
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
    return;
  }

  const prefix = store?.requestId ? ` [${store.requestId}]` : '';
  const line = `[${new Date().toISOString()}]${prefix} ${level.toUpperCase()}: ${message}`;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
};

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};
