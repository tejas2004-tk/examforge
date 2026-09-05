import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw new AppError(401, 'Authentication token missing');

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
};
