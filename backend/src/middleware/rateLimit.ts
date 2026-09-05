import { Request } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { env, isTest } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const minute = 60 * 1000;

/**
 * Keys on the authenticated user when there is one, so a shared NAT egress
 * address does not let one noisy tenant exhaust everyone else's budget, and
 * falls back to the (proxy-trusted) client IP for anonymous traffic.
 */
const keyGenerator = (req: Request): string => req.user?.id ?? req.ip ?? 'unknown';

/** Rate limiting an integration test suite only makes it flaky. */
const disabled = isTest;

interface LimiterSpec {
  name: string;
  windowMs: number;
  limit: number;
  message: string;
  keyBy?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

const build = ({ name, windowMs, limit, message, keyBy, skipSuccessfulRequests }: LimiterSpec) => {
  const options: Partial<Options> = {
    windowMs,
    limit: disabled ? 0 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyBy ?? keyGenerator,
    skipSuccessfulRequests: skipSuccessfulRequests ?? false,
    // A limit of 0 in express-rate-limit means "no limit", which is how the
    // test environment opts out without a second code path.
    skip: () => disabled,
    handler: (req, _res, next) => {
      logger.warn(`Rate limit '${name}' hit by ${keyGenerator(req)} on ${req.method} ${req.originalUrl}`);
      next(
        new AppError(
          429,
          message,
          { retryAfterSeconds: Math.ceil(windowMs / 1000) },
          'RATE_LIMITED',
        ),
      );
    },
  };
  return rateLimit(options);
};

/** Applied to every /api route as a blanket ceiling. */
export const globalLimiter = build({
  name: 'global',
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * minute,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  message: 'Too many requests. Slow down and try again shortly.',
});

/** Credential endpoints: counts only failures so a working client is unaffected. */
export const authLimiter = build({
  name: 'auth',
  windowMs: 15 * minute,
  limit: 20,
  message: 'Too many sign-in attempts from this address. Try again later.',
  keyBy: (req) => req.ip ?? 'unknown',
  skipSuccessfulRequests: true,
});

/** Registration is expensive (bcrypt plus an email) and rarely repeated. */
export const registrationLimiter = build({
  name: 'registration',
  windowMs: 60 * minute,
  limit: 5,
  message: 'Too many accounts created from this address.',
  keyBy: (req) => req.ip ?? 'unknown',
});

/** Password reset and verification both send mail to an address of the caller's choosing. */
export const passwordResetLimiter = build({
  name: 'password-reset',
  windowMs: 60 * minute,
  limit: 5,
  message: 'Too many password reset requests. Try again in an hour.',
  keyBy: (req) => req.ip ?? 'unknown',
});

export const emailVerificationLimiter = build({
  name: 'email-verification',
  windowMs: 60 * minute,
  limit: 10,
  message: 'Too many verification emails requested. Try again in an hour.',
  keyBy: (req) => req.ip ?? 'unknown',
});

/** Guards the second factor against online code guessing. */
export const twoFactorLimiter = build({
  name: 'two-factor',
  windowMs: 15 * minute,
  limit: 10,
  message: 'Too many two-factor attempts. Try again later.',
});

/** AI calls cost money per request and run against a third-party quota. */
export const aiLimiter = build({
  name: 'ai',
  windowMs: 60 * minute,
  limit: 60,
  message: 'AI request quota exhausted for this hour.',
});

export const uploadLimiter = build({
  name: 'upload',
  windowMs: 15 * minute,
  limit: 50,
  message: 'Too many uploads. Try again shortly.',
});

/** Search fans out across six tables, so it is capped more tightly than plain reads. */
export const searchLimiter = build({
  name: 'search',
  windowMs: minute,
  limit: 30,
  message: 'Too many searches. Try again in a moment.',
});

/** Code execution spawns a process per submission. */
export const codeExecutionLimiter = build({
  name: 'code-execution',
  windowMs: 5 * minute,
  limit: 30,
  message: 'Too many code executions. Try again shortly.',
});

/** Answer autosave fires on every keystroke batch, so it needs a generous ceiling. */
export const attemptWriteLimiter = build({
  name: 'attempt-write',
  windowMs: minute,
  limit: 240,
  message: 'Too many answer updates. Slow down.',
});
