import { z } from 'zod';

export const createProctoringSessionSchema = z.object({
  attemptId: z.string().optional(),
  testId: z.string().optional(),
  studentId: z.string().min(1),
  proctorId: z.string().optional(),
});

export const logProctoringEventSchema = z.object({
  type: z.string().min(1).max(100),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  message: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const captureSnapshotSchema = z.object({
  imageUrl: z.string().url().optional(),
  type: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const alertStudentSchema = z.object({
  message: z.string().min(1).max(1000),
});

export type CreateProctoringSessionInput = z.infer<typeof createProctoringSessionSchema>;
export type LogProctoringEventInput = z.infer<typeof logProctoringEventSchema>;
export type CaptureSnapshotInput = z.infer<typeof captureSnapshotSchema>;
export type AlertStudentInput = z.infer<typeof alertStudentSchema>;