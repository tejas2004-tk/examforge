export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
    /**
     * Stable machine-readable discriminator. Clients branch on this rather than
     * on the human-readable message, which is free to change.
     */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, details, 'BAD_REQUEST');

export const unauthorized = (message = 'Authentication required', code = 'UNAUTHENTICATED') =>
  new AppError(401, message, undefined, code);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, message, undefined, 'FORBIDDEN');

export const notFound = (resource = 'Resource') =>
  new AppError(404, `${resource} not found`, undefined, 'NOT_FOUND');

export const conflict = (message: string) => new AppError(409, message, undefined, 'CONFLICT');

export const tooManyRequests = (message: string, details?: unknown) =>
  new AppError(429, message, details, 'RATE_LIMITED');
