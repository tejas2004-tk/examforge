import { Difficulty, Prisma, QuestionType } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { orderBy, paged, parsePagination, parseSearch, parseSort } from '../utils/pagination.js';
import type { CreateQuestionInput, UpdateQuestionInput } from '../schemas/question.schema.js';
import { assertQuestionOwner, type Viewer } from './access.service.js';
import { isAdmin } from '../middleware/authorize.js';

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

const SORTABLE = ['createdAt', 'updatedAt', 'difficulty', 'type', 'topic'] as const;

const buildWhere = (query: Record<string, unknown>, viewer: Viewer): Prisma.QuestionWhereInput => {
  const where: Prisma.QuestionWhereInput = {};
  if (typeof query.type === 'string') where.type = query.type as QuestionType;
  if (typeof query.difficulty === 'string') where.difficulty = query.difficulty as Difficulty;
  if (typeof query.topic === 'string' && query.topic.trim()) where.topic = query.topic.trim();
  if (typeof query.status === 'string') where.status = query.status;
  const search = parseSearch(query);
  if (search) {
    where.OR = [{ text: { contains: search } }, { topic: { contains: search } }];
  }
  // A teacher's bank is private to them; only administrators see the whole pool.
  if (!isAdmin(viewer.role)) where.createdById = viewer.id;
  return where;
};

export const listQuestions = async (query: Record<string, unknown>, viewer: Viewer) => {
  const pagination = parsePagination(query);
  const sort = parseSort(query, SORTABLE, 'createdAt');
  const where = buildWhere(query, viewer);

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { options: true, tags: true, analytics: true },
      orderBy: orderBy(sort),
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.question.count({ where }),
  ]);

  return paged(items.map(serializeQuestion), pagination, total);
};

export const getQuestion = async (id: string, viewer: Viewer) => {
  // The serialised question carries correctAnswer and option.isCorrect, so it
  // is only ever returned to its author or an administrator.
  await assertQuestionOwner(id, viewer);
  const question = await prisma.question.findUnique({
    where: { id },
    include: { options: true, tags: true, analytics: true },
  });
  if (!question) throw new AppError(404, 'Question not found', undefined, 'NOT_FOUND');
  return serializeQuestion(question);
};

export const updateQuestion = async (id: string, input: UpdateQuestionInput, viewer: Viewer) => {
  await assertQuestionOwner(id, viewer);
  const existing = await prisma.question.findUniqueOrThrow({ where: { id } });

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

  const replaceOptions = Boolean(options) && OPTION_TYPES.includes(rest.type ?? existing.type);
  if (replaceOptions && options) {
    data.options = { create: options.map((o, i) => ({ ...o, orderIndex: i })) };
  }
  if (tags !== undefined) {
    data.tags = tags.length > 0 ? { create: tags.map((tag) => ({ tag })) } : undefined;
  }

  // Clearing options or tags and writing the replacements share a transaction so
  // a failure part way through cannot leave a question with no correct answer.
  const question = await prisma.$transaction(async (tx) => {
    if (replaceOptions) await tx.questionOption.deleteMany({ where: { questionId: id } });
    if (tags !== undefined) await tx.questionTag.deleteMany({ where: { questionId: id } });
    return tx.question.update({
      where: { id },
      data,
      include: { options: true, tags: true, analytics: true },
    });
  });
  return serializeQuestion(question);
};

export const deleteQuestion = async (id: string, viewer: Viewer) => {
  await assertQuestionOwner(id, viewer);
  // Refuse to remove an item that already carries responses; deleting it would
  // cascade the answers away and silently change every affected result.
  const usedInAttempts = await prisma.attemptAnswer.count({ where: { questionId: id } });
  if (usedInAttempts > 0) {
    throw new AppError(
      409,
      'This question has been answered in an attempt. Retire it instead of deleting it.',
      undefined,
      'CONFLICT',
    );
  }
  await prisma.question.delete({ where: { id } });
};
