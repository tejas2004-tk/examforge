import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError(401, 'Not authenticated');
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'You do not have permission to access this resource');
    }
    next();
  };
