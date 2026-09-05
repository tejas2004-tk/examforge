import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_BYTES,
  assertPasswordStrength,
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from '../src/utils/password.js';

const STRONG = 'Verdant-Harbour-71x';

describe('password policy', () => {
  it('accepts a long password mixing three character classes', () => {
    expect(validatePasswordStrength(STRONG)).toEqual([]);
  });

  it('rejects passwords shorter than the configured minimum', () => {
    expect(validatePasswordStrength('Ab3!x')).toContainEqual(expect.stringContaining('at least'));
  });

  it('rejects passwords drawing on fewer than three character classes', () => {
    expect(validatePasswordStrength('lowercaseonlypassword')).toContainEqual(
      expect.stringContaining('Mix at least three'),
    );
  });

  it('rejects known breached passwords regardless of casing', () => {
    expect(validatePasswordStrength('Password123')).toContainEqual(
      expect.stringContaining('breach lists'),
    );
  });

  it('rejects keyboard and alphabet runs in either direction', () => {
    expect(validatePasswordStrength('Tr1cky-abcd-Run')).toContainEqual(
      expect.stringContaining('runs'),
    );
    expect(validatePasswordStrength('Tr1cky-4321-Run')).toContainEqual(
      expect.stringContaining('runs'),
    );
  });

  it('rejects a password containing the account identity', () => {
    const problems = validatePasswordStrength('Rajveer-Secure-9x', {
      email: 'rajveer@example.com',
      fullName: 'Rajveer Kharade',
    });
    expect(problems).toContainEqual(expect.stringContaining('name, username or email'));
  });

  it('rejects a password longer than bcrypt can hash without truncating', () => {
    const problems = validatePasswordStrength(`${'A1b!'.repeat(20)}z`);
    expect(problems).toContainEqual(expect.stringContaining(`${MAX_PASSWORD_BYTES} bytes`));
  });

  it('throws a 400 with the failing rules attached', () => {
    try {
      assertPasswordStrength('password');
      throw new Error('expected the policy to reject this password');
    } catch (err) {
      const error = err as { statusCode: number; code: string; details: { password: string[] } };
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('WEAK_PASSWORD');
      expect(error.details.password.length).toBeGreaterThan(0);
    }
  });

  it('round-trips through bcrypt without matching a different password', async () => {
    const hash = await hashPassword(STRONG);
    expect(hash).not.toContain(STRONG);
    await expect(comparePassword(STRONG, hash)).resolves.toBe(true);
    await expect(comparePassword(`${STRONG}!`, hash)).resolves.toBe(false);
  });
});
