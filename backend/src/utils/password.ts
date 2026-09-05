import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

// bcrypt silently truncates at 72 bytes, so anything longer must be rejected
// rather than accepted with a shorter effective password.
export const MAX_PASSWORD_BYTES = 72;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, env.BCRYPT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

/**
 * Compares against a throwaway hash so a login attempt for an unknown address
 * costs the same wall-clock time as one for a real account.
 */
const DUMMY_HASH = bcrypt.hashSync('examforge-timing-equaliser', 10);
export const burnPasswordComparison = async (password: string): Promise<void> => {
  await bcrypt.compare(password, DUMMY_HASH);
};

/**
 * The 200 or so passwords that dominate real-world credential-stuffing lists,
 * plus the terms an ExamForge account is most likely to be seeded with. Kept
 * inline so password checks need no I/O on the login path.
 */
const COMMON_PASSWORDS = new Set(
  [
    '123456', '123456789', 'qwerty', 'password', '12345', 'qwerty123', '1q2w3e', '12345678',
    '111111', '1234567890', '1234567', '123123', '000000', 'abc123', 'password1', 'iloveyou',
    'dragon', 'monkey', 'sunshine', 'princess', 'football', 'baseball', 'welcome', 'admin',
    'letmein', 'login', 'master', 'shadow', 'superman', 'trustno1', 'passw0rd', 'qazwsx',
    'zaq12wsx', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'starwars', 'whatever', 'freedom',
    'batman', 'ninja', 'jordan', 'harley', 'ranger', 'hunter', 'buster', 'soccer', 'hockey',
    'killer', 'george', 'sexy', 'andrew', 'charlie', 'thomas', 'robert', 'access', 'love',
    'jessica', 'pepper', 'daniel', 'summer', 'ashley', 'bailey', 'knight', 'matthew', 'yellow',
    'secret', 'chelsea', 'diamond', 'nascar', 'jackson', 'cameron', 'orange', 'ginger',
    'hammer', 'silver', 'purple', 'scooter', 'phoenix', 'tigger', 'peanut', 'banana',
    'computer', 'michelle', 'internet', 'service', 'guitar', 'chicken', 'maggie', 'creative',
    'mercedes', 'liverpool', 'arsenal', 'chester', 'london', 'chicago', 'iloveu', 'chocolate',
    'chris', 'chelsea1', 'chevy', 'chris1', 'chuck', 'cocacola', 'coffee', 'cookie', 'cowboy',
    'p@ssword', 'p@ssw0rd', 'passw0rd1', 'password123', 'admin123', 'root', 'toor', 'test',
    'test123', 'testing', 'welcome1', 'welcome123', 'changeme', 'default', 'letmein123',
    'qwerty1234', 'iloveyou1', 'monkey123', 'dragon123', 'sunshine1', 'princess1', 'football1',
    'baseball1', 'superman1', 'trustno11', 'shadow1', 'master1', 'starwars1',
    'examforge', 'examforge1', 'examforge123', 'student', 'student123', 'teacher', 'teacher123',
    'exam', 'exam123', 'school', 'school123', 'college', 'university', 'institute', 'academy',
  ].map((entry) => entry.toLowerCase()),
);

export interface PasswordSubject {
  email?: string | null;
  username?: string | null;
  fullName?: string | null;
}

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const containsRun = (lowered: string): boolean =>
  SEQUENCES.some((seq) => {
    for (let i = 0; i + 4 <= seq.length; i += 1) {
      const run = seq.slice(i, i + 4);
      if (lowered.includes(run) || lowered.includes([...run].reverse().join(''))) return true;
    }
    return false;
  });

/** Tokens of 4+ characters taken from the account's own identity fields. */
const identityTokens = (subject: PasswordSubject): string[] => {
  const raw = [subject.email?.split('@')[0], subject.email?.split('@')[1]?.split('.')[0], subject.username, subject.fullName];
  return raw
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/i))
    .filter((token) => token.length >= 4);
};

export const validatePasswordStrength = (password: string, subject: PasswordSubject = {}): string[] => {
  const problems: string[] = [];
  const min = env.PASSWORD_MIN_LENGTH;

  if (password.length < min) problems.push(`Use at least ${min} characters`);
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    problems.push(`Use at most ${MAX_PASSWORD_BYTES} bytes`);
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    problems.push('Mix at least three of: lower case, upper case, digits, symbols');
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) problems.push('This password appears on public breach lists');
  if (/^(.)\1+$/.test(password)) problems.push('Do not repeat a single character');
  if (containsRun(lowered)) problems.push('Avoid keyboard or alphabet runs such as "abcd" or "1234"');

  for (const token of identityTokens(subject)) {
    if (lowered.includes(token)) {
      problems.push('Do not include your name, username or email address');
      break;
    }
  }

  return problems;
};

export const assertPasswordStrength = (password: string, subject: PasswordSubject = {}): void => {
  const problems = validatePasswordStrength(password, subject);
  if (problems.length > 0) {
    throw new AppError(400, 'Password does not meet the policy', { password: problems }, 'WEAK_PASSWORD');
  }
};
