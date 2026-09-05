import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // Body-parser / http-errors (e.g. entity.parse.failed, payload too large).
  if (err && typeof err === 'object' && 'expose' in err && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') {
      res.status(status).json({ success: false, message: String((err as { message?: unknown }).message ?? 'Request error') });
      return;
    }
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A record with this value already exists' });
      return;
    }
    logger.error('Database error', err.message);
    res.status(500).json({ success: false, message: 'Database error' });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', err.message);
    res.status(400).json({ success: false, message: 'Invalid data sent to the database' });
    return;
  }

  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
};
