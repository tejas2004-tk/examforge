import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId,
  });
};

interface Shaped {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  /** Kept out of the response and written only to the server log. */
  internal?: string;
}

/**
 * Prisma error messages embed table and column names and the failing query, so
 * they are translated to a generic message and the original is logged instead.
 */
const shapePrisma = (err: Prisma.PrismaClientKnownRequestError): Shaped => {
  switch (err.code) {
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'A record with this value already exists' };
    case 'P2003':
      return { status: 409, code: 'CONFLICT', message: 'This record is referenced by other data' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Record not found' };
    default:
      return {
        status: 500,
        code: 'DATABASE_ERROR',
        message: 'The request could not be completed',
        internal: `${err.code}: ${err.message}`,
      };
  }
};

const shape = (err: unknown): Shaped => {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      code: err.code ?? `HTTP_${err.statusCode}`,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: err.flatten(),
    };
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the maximum allowed size'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files in one request'
          : 'File upload rejected';
    return { status: 400, code: 'UPLOAD_REJECTED', message, internal: err.code };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) return shapePrisma(err);

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      code: 'INVALID_DATA',
      message: 'Invalid data sent to the database',
      internal: err.message,
    };
  }

  // body-parser / http-errors carry their own status (payload too large, bad JSON).
  if (err && typeof err === 'object' && 'status' in err && 'expose' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') {
      return {
        status,
        code: 'REQUEST_REJECTED',
        message: String((err as { message?: unknown }).message ?? 'Request error'),
      };
    }
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    internal: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
  };
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const shaped = shape(err);

  if (shaped.status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, shaped.internal ?? shaped.message, err);
  } else if (shaped.internal) {
    logger.warn(`${req.method} ${req.originalUrl} rejected`, shaped.internal);
  }

  if (res.headersSent) return;

  res.status(shaped.status).json({
    success: false,
    code: shaped.code,
    message: shaped.message,
    ...(shaped.details !== undefined ? { details: shaped.details } : {}),
    requestId: req.requestId,
    // Stack traces stay out of production responses; the request id is the link
    // between what the client saw and the full detail in the server log.
    ...(!isProduction && err instanceof Error && shaped.status >= 500
      ? { stack: err.stack }
      : {}),
  });
};
