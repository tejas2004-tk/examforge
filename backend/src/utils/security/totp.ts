import crypto from 'crypto';
import { authenticator } from 'otplib';

export function generateTwoFactorSecret(): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri('ExamForge', 'examforge.dev', secret);
  return { secret, otpauthUrl };
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

export function generateVerificationToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateEmailVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}