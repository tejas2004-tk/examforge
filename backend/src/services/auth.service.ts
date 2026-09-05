import { Role, User } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { generateTwoFactorSecret, verifyTwoFactorCode, generateEmailVerificationCode } from '../utils/security/totp.js';
import {
  findRefreshToken,
  persistRefreshToken,
  revokeRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from './token.service.js';
import {
  createVerificationToken,
  consumeVerificationToken,
  invalidateUserTokens,
} from './verificationToken.service.js';
import { verificationEmail, passwordResetEmail } from './email/mailer.service.js';

type PublicUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

export const toPublicUser = (user: User): PublicUser => {
  const { passwordHash: _ph, twoFactorSecret: _ts, ...rest } = user;
  return rest;
};

export const getUserById = async (id: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');
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
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: input.username }] },
  });
  if (existing) {
    throw new AppError(409, 'Email or username already in use');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      role: Role.STUDENT,
    },
  });

  // Queue email verification in dev logs via stub
  const code = generateEmailVerificationCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token: code,
      type: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const verifyEmailContent = verificationEmail(user.email, code);
  await sendStub(verifyEmailContent.to, verifyEmailContent.subject);

  return toPublicUser(user);
};

async function sendStub(to: string, subject: string) {
  // Import lazily to avoid circular issues
  const { sendEmail } = await import('./email/mailer.service.js');
  await sendEmail({ to, subject, html: '' });
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export const loginUser = async (
  email: string,
  password: string,
  twoFactorCode?: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError(401, 'Invalid email or password');

  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) throw new AppError(401, 'Invalid email or password');

  if (user.isBlocked || !user.isActive) {
    throw new AppError(403, 'Account is blocked or inactive');
  }

  // 2FA check
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!twoFactorCode) throw new AppError(428, 'Two-factor code required');
    if (!verifyTwoFactorCode(user.twoFactorSecret, twoFactorCode)) {
      throw new AppError(401, 'Invalid two-factor code');
    }
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);
  await persistRefreshToken(user.id, refreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Login history tracking
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      success: true,
    },
  });

  return { accessToken, refreshToken, user: toPublicUser(user) };
};

export const refreshSession = async (refreshToken: string): Promise<AuthResult> => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
  if (payload.type !== 'refresh') throw new AppError(401, 'Invalid token type');

  const stored = await findRefreshToken(refreshToken);
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Refresh token has been revoked or expired');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, 'Invalid or expired refresh token');
  if (user.isBlocked || !user.isActive) throw new AppError(403, 'Account is blocked or inactive');

  await revokeRefreshToken(refreshToken);
  const accessToken = signAccessToken(user.id, user.role);
  const newRefreshToken = signRefreshToken(user.id, user.role);
  await persistRefreshToken(user.id, newRefreshToken, REFRESH_TOKEN_TTL_MS);

  return { accessToken, refreshToken: newRefreshToken, user: toPublicUser(user) };
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
};

export const logoutUser = async (refreshToken?: string): Promise<void> => {
  if (!refreshToken) return;
  await revokeRefreshToken(refreshToken);
};

// --- Phase 17: Enhanced Auth ---

export async function forgotPassword(email: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return { sent: true }; // don't leak whether email exists

  const token = await createVerificationToken(user.id, 'PASSWORD_RESET');
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const emailContent = passwordResetEmail(user.email, resetLink);
  const { sendEmail } = await import('./email/mailer.service.js');
  await sendEmail(emailContent);
  return { sent: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeVerificationToken(token, 'PASSWORD_RESET');
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await invalidateUserTokens(userId, 'PASSWORD_RESET');
}

export async function verifyEmail(token: string): Promise<void> {
  const userId = await consumeVerificationToken(token, 'EMAIL_VERIFY');
  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });
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
  const emailContent = verificationEmail(user.email, code);
  const { sendEmail } = await import('./email/mailer.service.js');
  await sendEmail(emailContent);
  return { sent: true };
}

export async function enableTwoFactor(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Password is incorrect');
  if (user.twoFactorEnabled) throw new AppError(409, 'Two-factor already enabled');

  const { secret, otpauthUrl } = generateTwoFactorSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  return { secret, otpauthUrl };
}

export async function verifyTwoFactorSetup(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.twoFactorSecret) throw new AppError(400, 'Two-factor not initialized');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) throw new AppError(401, 'Invalid code');

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

export async function disableTwoFactor(userId: string, password: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new AppError(400, 'Two-factor not enabled');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Password is incorrect');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) throw new AppError(401, 'Invalid code');

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
}

export async function getLoginHistory(userId: string, limit: number = 20) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}