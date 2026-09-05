import { z } from 'zod';

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().optional(),
  answerJson: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  timeSpentSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});

export const suspiciousEventSchema = z.object({
  type: z.enum([
    'TAB_SWITCH',
    'WINDOW_BLUR',
    'FULLSCREEN_EXIT',
    'COPY',
    'PASTE',
    'CONTEXT_MENU',
    'WINDOW_RESIZE',
  ]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const gradeAnswerSchema = z.object({
  answerId: z.string().min(1),
  marks: z.coerce.number().min(0),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type SuspiciousEventInput = z.infer<typeof suspiciousEventSchema>;
export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;
