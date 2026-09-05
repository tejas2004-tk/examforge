import { z } from 'zod';

export const createCourseSchema = z.object({
  name: z.string().min(1).max(120),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Code may only contain letters, numbers and dashes'),
  description: z.string().max(500).optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
