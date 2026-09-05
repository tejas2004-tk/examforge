import { z } from 'zod';
import { Difficulty, QuestionType, BloomLevel } from '@prisma/client';

export const optionSchema = z.object({
  text: z.string().min(1).max(1000),
  isCorrect: z.boolean().default(false),
});

export const createQuestionFields = {
  text: z.string().min(1).max(5000),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(Difficulty),
  bloomLevel: z.nativeEnum(BloomLevel).optional(),
  marks: z.coerce.number().min(0).max(1000),
  negativeMarks: z.coerce.number().min(0).default(0),
  explanation: z.string().max(5000).optional(),
  options: z.array(optionSchema).min(2).max(10).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.record(z.string())]).optional(),
  reference: z.string().max(1000).optional(),
  estimatedTime: z.coerce.number().int().min(0).optional(),
  topic: z.string().max(200).optional(),
  subtopic: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).optional(),
};

export const createQuestionSchema = z.object(createQuestionFields).superRefine((data, ctx) => {
  const optionTypes: QuestionType[] = [QuestionType.SINGLE, QuestionType.MULTIPLE, QuestionType.TRUE_FALSE];
  const textTypes: QuestionType[] = [QuestionType.FILL_BLANK, QuestionType.CODING, QuestionType.SUBJECTIVE];

  if (optionTypes.includes(data.type)) {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'At least two options are required' });
    }
    const correct = (data.options ?? []).filter((o) => o.isCorrect).length;
    if (data.type === QuestionType.SINGLE || data.type === QuestionType.TRUE_FALSE) {
      if (correct !== 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Exactly one correct option is required' });
    }
    if (data.type === QuestionType.MULTIPLE && correct < 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'At least one correct option is required' });
    }
  }

  if (textTypes.includes(data.type) && data.type !== QuestionType.SUBJECTIVE && data.type !== QuestionType.CODING) {
    if (!data.correctAnswer) {
      ctx.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'A correct answer is required' });
    }
  }
});

export const updateQuestionSchema = z.object(createQuestionFields).partial();

export const listQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.string().optional(),
  difficulty: z.string().optional(),
  topic: z.string().optional(),
  bloomLevel: z.string().optional(),
  search: z.string().max(200).optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
