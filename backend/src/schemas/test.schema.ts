import { z } from 'zod';
import { Difficulty, TestStatus, ExamMode } from '@prisma/client';

export const testBaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  courseId: z.string().min(1).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  totalMarks: z.coerce.number().min(0).optional(),
  passingMarks: z.coerce.number().min(0),
  negativeMarks: z.coerce.number().min(0).default(0),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(false),
  randomOptionOrder: z.boolean().default(false),
  showResultImmediately: z.boolean().default(true),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  examMode: z.nativeEnum(ExamMode).optional(),
  password: z.string().max(100).optional().nullable(),
  gracePeriodMinutes: z.coerce.number().int().min(0).max(60).default(0),
  questionIds: z.array(z.string().min(1)).min(1).optional(),
});

export const createTestSchema = testBaseSchema;
export const updateTestSchema = testBaseSchema.partial();

export const assignTestSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

export const generateTestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  courseId: z.string().min(1).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  passingMarks: z.coerce.number().min(0),
  negativeMarks: z.coerce.number().min(0).default(0),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(true),
  config: z
    .array(
      z.object({
        difficulty: z.enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EXPERT]),
        count: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1),
});

export const listTestsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(TestStatus).optional(),
  search: z.string().max(200).optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type AssignTestInput = z.infer<typeof assignTestSchema>;
export type GenerateTestInput = z.infer<typeof generateTestSchema>;
