import { z } from 'zod';

export const createClassBatchSchema = z.object({
  name: z.string().min(1).max(200),
  courseId: z.string().min(1),
});

export const updateClassBatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const addStudentsSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

export type CreateClassBatchInput = z.infer<typeof createClassBatchSchema>;
export type UpdateClassBatchInput = z.infer<typeof updateClassBatchSchema>;
export type AddStudentsInput = z.infer<typeof addStudentsSchema>;
