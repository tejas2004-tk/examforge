import { z } from 'zod';
import { Role } from '@prisma/client';

const ASSIGNABLE_ROLES = [Role.ADMIN, Role.TEACHER, Role.STUDENT, Role.PROCTOR] as const;

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120).optional(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export const updateUserSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  isBlocked: z.boolean().optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().min(1).max(120).optional(),
});

/**
 * The fields a user may change on their own account. Role, block state and
 * email are deliberately absent: changing any of them is an administrator
 * action and goes through PATCH /api/users/:id.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  dob: z.string().datetime().optional().nullable(),
  qualification: z.string().max(200).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  search: z.string().max(200).optional(),
  sort: z.string().max(40).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
