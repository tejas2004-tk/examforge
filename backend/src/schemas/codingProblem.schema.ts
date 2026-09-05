import { z } from 'zod';

export const createCodingProblemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(50000),
  courseId: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  timeLimitMs: z.coerce.number().int().min(100).max(30000).optional(),
  memoryLimitMB: z.coerce.number().int().min(16).max(1024).optional(),
  allowedLanguages: z.array(z.string()).optional(),
  solution: z.string().optional(),
  testCases: z.array(z.object({
    input: z.string().optional(),
    expectedOutput: z.string().min(1),
    isPublic: z.boolean().optional(),
  })).optional(),
});

export const updateCodingProblemSchema = createCodingProblemSchema.partial();

export const executeCodeSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(100000),
});

export const addTestCaseSchema = z.object({
  input: z.string().optional(),
  expectedOutput: z.string().min(1),
  isPublic: z.boolean().optional(),
});

export type CreateCodingProblemInput = z.infer<typeof createCodingProblemSchema>;
export type UpdateCodingProblemInput = z.infer<typeof updateCodingProblemSchema>;
export type ExecuteCodeInput = z.infer<typeof executeCodeSchema>;
export type AddTestCaseInput = z.infer<typeof addTestCaseSchema>;