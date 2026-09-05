import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

/**
 * Preferences live in a single JSON column rather than a table of their own:
 * they are read as a whole, written as a whole, and never queried across users,
 * so a column keeps the read on the same row as the rest of the profile.
 */
export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
  emailDigest: z.enum(['off', 'daily', 'weekly']).default('weekly'),
  notifyOnResult: z.boolean().default(true),
  notifyOnAssignment: z.boolean().default(true),
  notifyOnAnnouncement: z.boolean().default(true),
  locale: z.string().min(2).max(10).default('en'),
  timezone: z.string().min(1).max(64).default('UTC'),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const preferencesPatchSchema = preferencesSchema.partial().strict();

export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({});

/** Unknown or malformed stored values fall back to the defaults field by field. */
const normalise = (stored: Prisma.JsonValue | null | undefined): Preferences => {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...DEFAULT_PREFERENCES };
  const parsed = preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, ...stored });
  return parsed.success ? parsed.data : { ...DEFAULT_PREFERENCES };
};

export const getPreferences = async (userId: string): Promise<Preferences> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  if (!user) throw new AppError(404, 'User not found', undefined, 'NOT_FOUND');
  return normalise(user.preferences);
};

export const updatePreferences = async (
  userId: string,
  patch: Partial<Preferences>,
): Promise<Preferences> => {
  const current = await getPreferences(userId);
  const next = preferencesSchema.parse({ ...current, ...patch });
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: next as unknown as Prisma.InputJsonValue },
  });
  return next;
};
