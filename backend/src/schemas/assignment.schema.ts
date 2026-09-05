import { z } from 'zod';

export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    courseId: z.string().optional(),
    maxMarks: z.coerce.number().min(0),
    dueAt: z.coerce.date().optional(),
    attachmentUrl: z.string().optional(),
  }),
});

export const updateAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    courseId: z.string().optional(),
    maxMarks: z.coerce.number().min(0).optional(),
    dueAt: z.coerce.date().optional(),
    attachmentUrl: z.string().optional(),
  }),
});

export const submitAssignmentSchema = z.object({
  body: z.object({
    answerText: z.string().max(10000).optional(),
    fileUrl: z.string().optional(),
  }).refine((data) => data.answerText || data.fileUrl, {
    message: 'Provide either answer text or a file URL',
  }),
});

export const gradeSubmissionSchema = z.object({
  body: z.object({
    marks: z.coerce.number().min(0),
    feedback: z.string().max(2000).optional(),
  }),
});

export const listAssignmentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    courseId: z.string().optional(),
    search: z.string().optional(),
  }),
});
