import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Raw tokens are never stored; only their SHA-256 digest is persisted. */
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const OS_PATTERNS: [RegExp, string][] = [
  [/windows nt/i, 'Windows'],
  [/android/i, 'Android'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/mac os x/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/edg\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/chrome\//i, 'Chrome'],
  [/firefox\//i, 'Firefox'],
  [/safari\//i, 'Safari'],
];

/**
 * A coarse label is enough for the sessions list, and avoids shipping a
 * user-agent parsing dependency that needs regular data updates.
 */
export const describeDevice = (userAgent?: string | null): string => {
  if (!userAgent) return 'Unknown device';
  const os = OS_PATTERNS.find(([re]) => re.test(userAgent))?.[1];
  const browser = BROWSER_PATTERNS.find(([re]) => re.test(userAgent))?.[1];
  if (os && browser) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
};

export interface PersistOptions extends SessionMeta {
  familyId?: string;
  ttlMs?: number;
}

export const persistRefreshToken = async (
  userId: string,
  token: string,
  options: PersistOptions = {},
) => {
  const ttlMs = options.ttlMs ?? REFRESH_TOKEN_TTL_MS;
  const created = await prisma.refreshToken.create({
    data: {
      token: hashToken(token),
      userId,
      familyId: options.familyId ?? crypto.randomUUID(),
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      device: describeDevice(options.userAgent),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return created;
};

export const findRefreshToken = (token: string) =>
  prisma.refreshToken.findUnique({ where: { token: hashToken(token) } });

export const revokeRefreshToken = (token: string, reason = 'logout') =>
  prisma.refreshToken.updateMany({
    where: { token: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

export const revokeAllUserTokens = (userId: string, reason = 'revoked') =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

/**
 * Reuse detection: a rotated token is revoked but kept on file. Seeing it again
 * means either the legitimate holder replayed a stale token or an attacker is
 * using a stolen copy; either way the whole family is burned so both parties
 * must reauthenticate.
 */
export const revokeTokenFamily = async (familyId: string, reason: string) => {
  const result = await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  logger.warn(`Revoked refresh token family ${familyId} (${reason}); ${result.count} live tokens`);
  return result.count;
};

export const rotateRefreshToken = async (
  previousTokenId: string,
  userId: string,
  nextToken: string,
  familyId: string,
  meta: SessionMeta,
) => {
  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.refreshToken.create({
      data: {
        token: hashToken(nextToken),
        userId,
        familyId,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        device: describeDevice(meta.userAgent),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    await tx.refreshToken.update({
      where: { id: previousTokenId },
      data: { revokedAt: new Date(), revokedReason: 'rotated', replacedById: next.id, lastUsedAt: new Date() },
    });
    return next;
  });
  return created;
};

export const listActiveSessions = async (userId: string, currentTokenHash?: string) => {
  const rows = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    id: row.id,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    device: row.device ?? describeDevice(row.userAgent),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    current: currentTokenHash !== undefined && row.token === currentTokenHash,
  }));
};

export const revokeSessionById = async (userId: string, sessionId: string) => {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'user_revoked' },
  });
  return result.count;
};

export const revokeOtherSessions = async (userId: string, keepTokenHash?: string) => {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepTokenHash ? { token: { not: keepTokenHash } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: 'user_revoked_all' },
  });
  return result.count;
};

export const purgeExpiredTokens = () =>
  prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });
