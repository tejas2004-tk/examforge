import { Difficulty, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import type { GenerateTestInput } from '../schemas/test.schema.js';

export const createBank = async (userId: string, input: { name: string; courseId?: string }) => {
  return prisma.questionBank.create({
    data: { name: input.name, courseId: input.courseId, createdById: userId },
  });
};

export const listBanks = async (query: Record<string, unknown>, userId: string) => {
  const { page, limit, skip } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;

  const where: Prisma.QuestionBankWhereInput = { createdById: userId };
  if (search) where.name = { contains: search };

  const [items, total] = await Promise.all([
    prisma.questionBank.findMany({
      where,
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.questionBank.count({ where }),
  ]);

  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getBank = async (id: string, userId: string) => {
  const bank = await prisma.questionBank.findFirst({
    where: { id, createdById: userId },
    include: { questions: { include: { question: { include: { options: true } } } } },
  });
  if (!bank) throw new AppError(404, 'Question bank not found');
  return bank;
};

export const addQuestionToBank = async (bankId: string, userId: string, questionId: string) => {
  await getBank(bankId, userId);
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new AppError(404, 'Question not found');

  return prisma.questionBankQuestion.upsert({
    where: { bankId_questionId: { bankId, questionId } },
    update: {},
    create: { bankId, questionId },
  });
};

export const removeQuestionFromBank = async (bankId: string, userId: string, questionId: string) => {
  await getBank(bankId, userId);
  await prisma.questionBankQuestion.deleteMany({ where: { bankId, questionId } });
};

export const deleteBank = async (id: string, userId: string) => {
  await getBank(id, userId);
  await prisma.questionBank.delete({ where: { id } });
};

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
  EXPERT: 3,
};

export const generateTestFromBank = async (userId: string, bankId: string, input: GenerateTestInput) => {
  const bank = await getBank(bankId, userId);
  const bankQuestionIds = bank.questions.map((q) => q.questionId);

  const selected: { id: string; marks: Prisma.Decimal }[] = [];
  for (const cfg of [...input.config].sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty])) {
    const pool = await prisma.question.findMany({
      where: { id: { in: bankQuestionIds }, difficulty: cfg.difficulty },
      select: { id: true, marks: true },
    });
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, cfg.count);
    if (shuffled.length < cfg.count) {
      throw new AppError(
        400,
        `Only ${shuffled.length} ${cfg.difficulty} questions available in this bank (need ${cfg.count})`,
      );
    }
    selected.push(...shuffled);
  }

  if (selected.length === 0) throw new AppError(400, 'No questions matched the configuration');
  const questionIds = selected.map((q) => q.id);
  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks), 0);

  return prisma.test.create({
    data: {
      title: input.title,
      description: input.description,
      courseId: input.courseId,
      durationMinutes: input.durationMinutes,
      totalMarks: new Prisma.Decimal(totalMarks),
      passingMarks: new Prisma.Decimal(input.passingMarks),
      negativeMarks: new Prisma.Decimal(input.negativeMarks),
      maxAttempts: input.maxAttempts,
      shuffleQuestions: input.shuffleQuestions,
      createdById: userId,
      testQuestions: {
        create: questionIds.map((qid, i) => ({ questionId: qid, orderIndex: i })),
      },
    },
  });
};
