import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Accepts an inbound X-Request-Id only when it looks like an opaque id, so a
 * client cannot inject newlines or control characters into the log stream.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const inbound = req.get('x-request-id');
  const requestId = inbound && ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  requestContext.run({ requestId, method: req.method, path: req.path }, () => next());
};

/** Attaches the authenticated user id to the log context once auth has run. */
export const bindUserToContext = (userId: string): void => {
  const store = requestContext.getStore();
  if (store) store.userId = userId;
};
