import { Role, User } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';
import {
  assertPasswordStrength,
  burnPasswordComparison,
  comparePassword,
  hashPassword,
} from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';
import {
  generateTwoFactorSecret,
  verifyTwoFactorCode,
  generateEmailVerificationCode,
} from '../utils/security/totp.js';
import {
  findRefreshToken,
  persistRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  revokeTokenFamily,
  rotateRefreshToken,
  type SessionMeta,
} from './token.service.js';
import {
  createVerificationToken,
  consumeVerificationToken,
  invalidateUserTokens,
} from './verificationToken.service.js';
import { verificationEmail, passwordResetEmail, sendEmail } from './email/mailer.service.js';
import { logAudit } from './audit.service.js';

type PublicUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

export const toPublicUser = (user: User): PublicUser => {
  const { passwordHash: _ph, twoFactorSecret: _ts, ...rest } = user;
  return rest;
};

export const getUserById = async (id: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');
  return toPublicUser(user);
};

interface RegisterInput {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}

export const registerUser = async (input: RegisterInput): Promise<PublicUser> => {
  const email = input.email.toLowerCase();
  assertPasswordStrength(input.password, {
    email,
    username: input.username,
    fullName: input.fullName,
  });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: input.username }] },
  });
  if (existing) {
    throw new AppError(409, 'Email or username already in use', undefined, 'CONFLICT');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      role: Role.STUDENT,
      lastPasswordChangeAt: new Date(),
    },
  });

  const code = generateEmailVerificationCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token: code,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await sendEmail(verificationEmail(user.email, code));

  return toPublicUser(user);
};

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

// --- Progressive lockout ---------------------------------------------------

/**
 * Lockout grows geometrically from the first failure past the threshold, so a
 * user who mistypes once is unaffected while an online guessing run is slowed
 * to a handful of attempts an hour.
 */
const lockoutDurationMs = (failureCount: number): number => {
  const over = Math.max(0, failureCount - env.LOGIN_MAX_FAILURES);
  const seconds = Math.min(
    env.LOGIN_LOCKOUT_MAX_SECONDS,
    env.LOGIN_LOCKOUT_BASE_SECONDS * 2 ** over,
  );
  return seconds * 1000;
};

const recordLoginAttempt = async (
  userId: string,
  success: boolean,
  reason: string | undefined,
  meta?: SessionMeta,
) => {
  await prisma.loginHistory.create({
    data: {
      userId,
      ip: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      success,
      reason: reason ?? null,
    },
  });
};

const registerFailure = async (user: User, reason: string, meta?: SessionMeta) => {
  const failureCount = user.failedLoginCount + 1;
  const shouldLock = failureCount >= env.LOGIN_MAX_FAILURES;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: failureCount,
      lockedUntil: shouldLock ? new Date(Date.now() + lockoutDurationMs(failureCount)) : null,
    },
  });
  await recordLoginAttempt(user.id, false, reason, meta);
  if (shouldLock) {
    logger.warn(`Account ${user.id} locked after ${failureCount} failed sign-in attempts`);
    await logAudit({
      userId: user.id,
      action: 'ACCOUNT_LOCKED',
      entity: 'User',
      entityId: user.id,
      metadata: { failureCount, reason },
      ip: meta?.ipAddress ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
    });
  }
};

const lockedError = (until: Date) => {
  const seconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  return new AppError(
    423,
    `Too many failed sign-in attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
    { retryAfterSeconds: seconds, lockedUntil: until.toISOString() },
    'ACCOUNT_LOCKED',
  );
};

export const loginUser = async (
  email: string,
  password: string,
  twoFactorCode?: string,
  meta?: SessionMeta,
): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Equalise timing so a missing address is not distinguishable from a wrong password.
    await burnPasswordComparison(password);
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLoginAttempt(user.id, false, 'locked', meta);
    throw lockedError(user.lockedUntil);
  }

  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    await registerFailure(user, 'bad_password', meta);
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.isBlocked || !user.isActive) {
    await recordLoginAttempt(user.id, false, 'blocked', meta);
    throw forbidden('Account is blocked or inactive');
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!twoFactorCode) {
      throw new AppError(428, 'Two-factor code required', undefined, 'TWO_FACTOR_REQUIRED');
    }
    if (!verifyTwoFactorCode(user.twoFactorSecret, twoFactorCode)) {
      await registerFailure(user, 'bad_2fa', meta);
      throw unauthorized('Invalid two-factor code', 'INVALID_TWO_FACTOR');
    }
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);
  await persistRefreshToken(user.id, refreshToken, meta);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await recordLoginAttempt(user.id, true, undefined, meta);
  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    ip: meta?.ipAddress ?? undefined,
    userAgent: meta?.userAgent ?? undefined,
  });

  return { accessToken, refreshToken, user: toPublicUser(user) };
};

export const refreshSession = async (
  refreshToken: string,
  meta?: SessionMeta,
): Promise<AuthResult> => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('Invalid or expired refresh token', 'REFRESH_INVALID');
  }
  if (payload.type !== 'refresh') throw unauthorized('Invalid token type', 'REFRESH_INVALID');

  const stored = await findRefreshToken(refreshToken);
  if (!stored) throw unauthorized('Invalid or expired refresh token', 'REFRESH_INVALID');

  if (stored.revokedAt) {
    // The token was already rotated or revoked: burn the family and force a
    // full sign-in, because the presenter may not be the legitimate holder.
    await revokeTokenFamily(stored.familyId, 'reuse_detected');
    await logAudit({
      userId: stored.userId,
      action: 'REFRESH_TOKEN_REUSE',
      entity: 'RefreshToken',
      entityId: stored.id,
      metadata: { familyId: stored.familyId },
      ip: meta?.ipAddress ?? undefined,
      userAgent: meta?.userAgent ?? undefined,
    });
    throw unauthorized('Session was revoked. Sign in again.', 'REFRESH_REUSED');
  }

  if (stored.expiresAt < new Date()) {
    throw unauthorized('Refresh token has expired', 'REFRESH_EXPIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw unauthorized('Invalid or expired refresh token', 'REFRESH_INVALID');
  if (user.isBlocked || !user.isActive) throw forbidden('Account is blocked or inactive');

  const accessToken = signAccessToken(user.id, user.role);
  const newRefreshToken = signRefreshToken(user.id, user.role);
  await rotateRefreshToken(stored.id, user.id, newRefreshToken, stored.familyId, {
    ipAddress: meta?.ipAddress ?? stored.ipAddress,
    userAgent: meta?.userAgent ?? stored.userAgent,
  });

  return { accessToken, refreshToken: newRefreshToken, user: toPublicUser(user) };
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta?: SessionMeta,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');

  assertPasswordStrength(newPassword, {
    email: user.email,
    username: user.username,
    fullName: user.fullName,
  });
  if (await comparePassword(newPassword, user.passwordHash)) {
    throw new AppError(400, 'New password must differ from the current one', undefined, 'WEAK_PASSWORD');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, lastPasswordChangeAt: new Date() },
  });
  // Every issued session predates the new secret, so none of them survive.
  await revokeAllUserTokens(userId, 'password_changed');
  await logAudit({
    userId,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: userId,
    ip: meta?.ipAddress ?? undefined,
    userAgent: meta?.userAgent ?? undefined,
  });
};

export const logoutUser = async (refreshToken?: string): Promise<void> => {
  if (!refreshToken) return;
  await revokeRefreshToken(refreshToken, 'logout');
};

export async function forgotPassword(email: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // The same response is returned either way so the endpoint cannot enumerate addresses.
  if (!user) return { sent: true };

  const token = await createVerificationToken(user.id, 'PASSWORD_RESET');
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail(passwordResetEmail(user.email, resetLink));
  return { sent: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeVerificationToken(token, 'PASSWORD_RESET');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(400, 'Invalid or expired token', undefined, 'BAD_REQUEST');

  assertPasswordStrength(newPassword, {
    email: user.email,
    username: user.username,
    fullName: user.fullName,
  });

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, lastPasswordChangeAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await invalidateUserTokens(userId, 'PASSWORD_RESET');
  await revokeAllUserTokens(userId, 'password_reset');
  await logAudit({ userId, action: 'PASSWORD_RESET', entity: 'User', entityId: userId });
}

export async function verifyEmail(token: string): Promise<void> {
  const userId = await consumeVerificationToken(token, 'EMAIL_VERIFY');
  await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });
}

export async function resendVerification(email: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.isEmailVerified) return { sent: true };

  const code = generateEmailVerificationCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token: code,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await sendEmail(verificationEmail(user.email, code));
  return { sent: true };
}

export async function enableTwoFactor(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw unauthorized('Password is incorrect', 'INVALID_CREDENTIALS');
  if (user.twoFactorEnabled) throw new AppError(409, 'Two-factor already enabled', undefined, 'CONFLICT');

  const { secret, otpauthUrl } = generateTwoFactorSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  return { secret, otpauthUrl };
}

export async function verifyTwoFactorSetup(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');
  if (!user.twoFactorSecret) throw new AppError(400, 'Two-factor not initialized', undefined, 'BAD_REQUEST');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    throw unauthorized('Invalid code', 'INVALID_TWO_FACTOR');
  }

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  await logAudit({ userId, action: 'TWO_FACTOR_ENABLED', entity: 'User', entityId: userId });
}

export async function disableTwoFactor(userId: string, password: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(400, 'Two-factor not enabled', undefined, 'BAD_REQUEST');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw unauthorized('Password is incorrect', 'INVALID_CREDENTIALS');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    throw unauthorized('Invalid code', 'INVALID_TWO_FACTOR');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await logAudit({ userId, action: 'TWO_FACTOR_DISABLED', entity: 'User', entityId: userId });
}

export async function getLoginHistory(userId: string, limit = 20) {
  const rows = await prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((row) => ({
    id: row.id,
    ipAddress: row.ip,
    userAgent: row.userAgent,
    success: row.success,
    createdAt: row.createdAt,
  }));
}

export async function getSecurityOverview(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [user, activeSessions, failedAttempts24h, lastSuccess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, lastPasswordChangeAt: true, lastLoginAt: true },
    }),
    prisma.refreshToken.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    prisma.loginHistory.count({ where: { userId, success: false, createdAt: { gte: since } } }),
    prisma.loginHistory.findFirst({
      where: { userId, success: true },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');

  return {
    twoFactorEnabled: user.twoFactorEnabled,
    activeSessions,
    lastPasswordChangeAt: user.lastPasswordChangeAt,
    lastLoginAt: user.lastLoginAt ?? lastSuccess?.createdAt ?? null,
    failedAttempts24h,
  };
}
