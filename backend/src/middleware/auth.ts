import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError, unauthorized } from '../utils/errors.js';
import { bindUserToContext } from './requestContext.js';

export interface AuthenticatedUser {
  id: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const readBearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = readBearer(req);
  if (!token) throw unauthorized('Authentication token missing', 'TOKEN_MISSING');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw unauthorized('Invalid or expired token', 'TOKEN_INVALID');
  }

  // A refresh token is signed with a different secret, but rejecting the wrong
  // type explicitly keeps the invariant obvious if the secrets are ever unified.
  if (payload.type !== 'access') throw unauthorized('Invalid token type', 'TOKEN_INVALID');

  req.user = { id: payload.sub, role: payload.role };
  bindUserToContext(payload.sub);
  next();
};

/** Populates req.user when a valid token is present, without demanding one. */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    if (payload.type === 'access') {
      req.user = { id: payload.sub, role: payload.role };
      bindUserToContext(payload.sub);
    }
  } catch {
    // An unusable token on an optional route is treated as anonymous.
  }
  next();
};

export const currentUser = (req: Request): AuthenticatedUser => {
  if (!req.user) throw new AppError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED');
  return req.user;
};
