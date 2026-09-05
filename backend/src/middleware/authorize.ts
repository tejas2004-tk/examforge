import { NextFunction, Request, Response } from 'express';
import { AppError, forbidden } from '../utils/errors.js';

export const ADMIN_ROLES = ['ADMIN', 'ORG_ADMIN'] as const;
export const STAFF_ROLES = ['ADMIN', 'ORG_ADMIN', 'TEACHER'] as const;

export const isAdmin = (role: string): boolean => (ADMIN_ROLES as readonly string[]).includes(role);
export const isStaff = (role: string): boolean => (STAFF_ROLES as readonly string[]).includes(role);

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED');
    if (!roles.includes(req.user.role)) {
      throw forbidden('You do not have permission to access this resource');
    }
    next();
  };

/**
 * Guards a route whose handler mutates or reads a specific object. The resolver
 * returns the owning user id (or null when the object does not exist) and the
 * request proceeds only for that owner or an administrator.
 */
export const requireOwnership =
  (resolveOwnerId: (req: Request) => Promise<string | null>, resourceName = 'Resource') =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED');
      if (isAdmin(req.user.role)) return next();

      const ownerId = await resolveOwnerId(req);
      if (ownerId === null) {
        throw new AppError(404, `${resourceName} not found`, undefined, 'NOT_FOUND');
      }
      if (ownerId !== req.user.id) throw forbidden(`You do not own this ${resourceName.toLowerCase()}`);
      next();
    } catch (error) {
      next(error);
    }
  };
