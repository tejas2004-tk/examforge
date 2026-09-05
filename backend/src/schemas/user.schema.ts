import { z } from 'zod';
import { Role } from '@prisma/client';

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120).optional(),
  role: z.enum([Role.ADMIN, Role.TEACHER, Role.STUDENT]),
});

export const updateUserSchema = z.object({
  role: z.enum([Role.ADMIN, Role.TEACHER, Role.STUDENT]).optional(),
  isBlocked: z.boolean().optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().min(1).max(120).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  role: z.enum([Role.ADMIN, Role.TEACHER, Role.STUDENT]).optional(),
  search: z.string().max(200).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
