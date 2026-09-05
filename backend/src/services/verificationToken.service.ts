import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { generateVerificationToken } from '../utils/security/totp.js';

export type VerificationTokenType = 'EMAIL_VERIFY' | 'PASSWORD_RESET';

export async function createVerificationToken(userId: string, type: VerificationTokenType) {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await prisma.verificationToken.create({
    data: { userId, token, type, expiresAt },
  });

  return token;
}

export async function consumeVerificationToken(token: string, type: VerificationTokenType): Promise<string> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.type !== type) throw new AppError(400, 'Invalid or expired token');
  if (record.usedAt) throw new AppError(400, 'Token has already been used');
  if (record.expiresAt < new Date()) throw new AppError(400, 'Token has expired');

  await prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.userId;
}

export async function invalidateUserTokens(userId: string, type: VerificationTokenType) {
  await prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
}