import crypto from 'crypto';
import { prisma } from '../config/database.js';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const persistRefreshToken = async (
  userId: string,
  token: string,
  ttlMs: number = REFRESH_TOKEN_TTL_MS,
): Promise<void> => {
  await prisma.refreshToken.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
};

export const findRefreshToken = (token: string) =>
  prisma.refreshToken.findUnique({ where: { token: hashToken(token) } });

export const revokeRefreshToken = (token: string) =>
  prisma.refreshToken.updateMany({
    where: { token: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });

export const revokeAllUserTokens = (userId: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
