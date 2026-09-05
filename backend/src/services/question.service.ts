import { Difficulty, Prisma, QuestionType } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import type { CreateQuestionInput, UpdateQuestionInput } from '../schemas/question.schema.js';

export interface SerializedQuestion {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  bloomLevel: string | null;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  correctAnswer: unknown;
  reference: string | null;
  estimatedTime: number | null;
  topic: string | null;
  subtopic: string | null;
  status: string;
  version: number;
  tags: string[];
  analytics: { attemptCount: number; correctCount: number; incorrectCount: number; accuracy: number } | null;
  options: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export const serializeQuestion = (q: any): SerializedQuestion => ({
  id: q.id,
  text: q.text,
  type: q.type,
  difficulty: q.difficulty,
  bloomLevel: q.bloomLevel ?? null,
  marks: Number(q.marks),
  negativeMarks: Number(q.negativeMarks),
  explanation: q.explanation,
  correctAnswer: q.correctAnswer,
  reference: q.reference ?? null,
  estimatedTime: q.estimatedTime ?? null,
  topic: q.topic ?? null,
  subtopic: q.subtopic ?? null,
  status: q.status ?? 'ACTIVE',
  version: q.version ?? 1,
  tags: q.tags ? q.tags.map((t: any) => t.tag) : [],
  analytics: q.analytics ?? null,
  options: q.options ? [...q.options].sort((a: any, b: any) => a.orderIndex - b.orderIndex) : [],
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
});

const OPTION_TYPES: QuestionType[] = [QuestionType.SINGLE, QuestionType.MULTIPLE, QuestionType.TRUE_FALSE];

export const createQuestion = async (userId: string, input: CreateQuestionInput) => {
  const { options, correctAnswer, tags, ...rest } = input;

  const question = await prisma.question.create({
    data: {
      ...rest,
      marks: new Prisma.Decimal(rest.marks),
      negativeMarks: new Prisma.Decimal(rest.negativeMarks),
      correctAnswer: correctAnswer ?? Prisma.JsonNull,
      createdById: userId,
      ...(OPTION_TYPES.includes(rest.type) && options
        ? {
            options: {
              create: options.map((o, i) => ({ ...o, orderIndex: i })),
            },
          }
        : {}),
      ...(tags && tags.length > 0
        ? {
            tags: {
              create: tags.map((tag) => ({ tag })),
            },
          }
        : {}),
    },
    include: { options: true, tags: true, analytics: true },
  });

  return serializeQuestion(question);
};

const buildWhere = (query: Record<string, unknown>, userId?: string): Prisma.QuestionWhereInput => {
  const where: Prisma.QuestionWhereInput = {};
  if (typeof query.type === 'string') where.type = query.type as QuestionType;
  if (typeof query.difficulty === 'string') where.difficulty = query.difficulty as Difficulty;
  if (typeof query.topic === 'string' && query.topic.trim()) where.topic = query.topic.trim();
  if (typeof query.search === 'string' && query.search.trim()) {
    where.OR = [
      { text: { contains: query.search.trim() } },
      { topic: { contains: query.search.trim() } },
    ];
  }
  if (userId) where.createdById = userId;
  return where;
};

export const listQuestions = async (query: Record<string, unknown>, userId?: string) => {
  const { page, limit, skip } = parsePagination(query);
  const where = buildWhere(query, userId);

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { options: true, tags: true, analytics: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    items: items.map(serializeQuestion),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getQuestion = async (id: string) => {
  const question = await prisma.question.findUnique({ where: { id }, include: { options: true, tags: true, analytics: true } });
  if (!question) throw new AppError(404, 'Question not found');
  return serializeQuestion(question);
};

export const updateQuestion = async (id: string, input: UpdateQuestionInput) => {
  const existing = await prisma.question.findUnique({ where: { id }, include: { options: true, tags: true, analytics: true } });
  if (!existing) throw new AppError(404, 'Question not found');

  const { options, correctAnswer, tags, ...rest } = input;

  const data: Prisma.QuestionUpdateInput = {};
  if (rest.text) data.text = rest.text;
  if (rest.type) data.type = rest.type;
  if (rest.difficulty) data.difficulty = rest.difficulty;
  if (rest.bloomLevel !== undefined) data.bloomLevel = rest.bloomLevel as any;
  if (rest.marks !== undefined) data.marks = new Prisma.Decimal(rest.marks);
  if (rest.negativeMarks !== undefined) data.negativeMarks = new Prisma.Decimal(rest.negativeMarks);
  if (rest.explanation !== undefined) data.explanation = rest.explanation;
  if (rest.reference !== undefined) data.reference = rest.reference;
  if (rest.estimatedTime !== undefined) data.estimatedTime = rest.estimatedTime;
  if (rest.topic !== undefined) data.topic = rest.topic;
  if (rest.subtopic !== undefined) data.subtopic = rest.subtopic;
  if (correctAnswer !== undefined) data.correctAnswer = correctAnswer ?? Prisma.JsonNull;

  if (options && OPTION_TYPES.includes(rest.type ?? existing.type)) {
    await prisma.questionOption.deleteMany({ where: { questionId: id } });
    data.options = { create: options.map((o, i) => ({ ...o, orderIndex: i })) };
  }

  if (tags !== undefined) {
    await prisma.questionTag.deleteMany({ where: { questionId: id } });
    data.tags = tags.length > 0 ? { create: tags.map((tag) => ({ tag })) } : undefined;
  }

  const question = await prisma.question.update({
    where: { id },
    data,
    include: { options: true, tags: true, analytics: true },
  });
  return serializeQuestion(question);
};

export const deleteQuestion = async (id: string) => {
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw new AppError(404, 'Question not found');
  await prisma.question.delete({ where: { id } });
};
