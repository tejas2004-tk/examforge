import { Prisma, TestStatus, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import type { CreateTestInput, UpdateTestInput, AssignTestInput } from '../schemas/test.schema.js';
import { serializeQuestion } from './question.service.js';
import { createManyNotifications } from './notification.service.js';

const dateOrUndef = (v?: string | null) => (v ? new Date(v) : undefined);

const getQuestionIds = async (questionIds: string[]): Promise<{ id: string; marks: Prisma.Decimal }[]> => {
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, marks: true },
  });
  if (questions.length !== new Set(questionIds).size) {
    throw new AppError(400, 'One or more questions do not exist');
  }
  return questions;
};

export const createTest = async (userId: string, input: CreateTestInput) => {
  const { questionIds, totalMarks, ...rest } = input;

  const questions = questionIds ? await getQuestionIds(questionIds) : [];
  const computedTotal = totalMarks ?? questions.reduce((sum, q) => sum + Number(q.marks), 0);

  return prisma.test.create({
    data: {
      ...rest,
      startAt: dateOrUndef(input.startAt),
      endAt: dateOrUndef(input.endAt),
      totalMarks: new Prisma.Decimal(computedTotal),
      passingMarks: new Prisma.Decimal(input.passingMarks),
      negativeMarks: new Prisma.Decimal(input.negativeMarks),
      createdById: userId,
      testQuestions: questionIds
        ? { create: questionIds.map((qid, i) => ({ questionId: qid, orderIndex: i })) }
        : undefined,
    },
  });
};

export const listTests = async (viewer: { id: string; role: string }, query: Record<string, unknown>) => {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.TestWhereInput = {};
  if (viewer.role === Role.TEACHER) where.createdById = viewer.id;
  if (typeof query.status === 'string') where.status = query.status as TestStatus;
  if (typeof query.search === 'string' && query.search.trim()) {
    where.title = { contains: query.search.trim() };
  }

  const [items, total] = await Promise.all([
    prisma.test.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, code: true } },
        _count: { select: { testQuestions: true, attempts: true, assignments: true, sections: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.test.count({ where }),
  ]);

  return {
    items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getTest = async (id: string) => {
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      course: true,
      sections: { orderBy: { orderIndex: 'asc' } },
      testQuestions: {
        include: { question: { include: { options: true, tags: true, analytics: true } } },
        orderBy: { orderIndex: 'asc' },
      },
      assignments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
    },
  });
  if (!test) throw new AppError(404, 'Test not found');

  return {
    ...test,
    totalMarks: Number(test.totalMarks),
    passingMarks: Number(test.passingMarks),
    negativeMarks: Number(test.negativeMarks),
    password: test.password ? '***' : null,
    questions: test.testQuestions.map((tq) => ({
      orderIndex: tq.orderIndex,
      ...serializeQuestion(tq.question),
    })),
  };
};

export const getAssignedTest = async (id: string) => {
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, name: true, code: true } },
      testQuestions: {
        include: { question: { select: { id: true, text: true, type: true, difficulty: true, marks: true } } },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });
  if (!test) throw new AppError(404, 'Test not found');
  return {
    ...test,
    totalMarks: Number(test.totalMarks),
    passingMarks: Number(test.passingMarks),
    negativeMarks: Number(test.negativeMarks),
  };
};

export const updateTest = async (id: string, viewer: { id: string; role: string }, input: UpdateTestInput) => {
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) throw new AppError(404, 'Test not found');
  if (viewer.role !== Role.ADMIN && test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');
  if (test.status !== TestStatus.DRAFT) {
    throw new AppError(400, 'Only draft tests can be edited. Unpublish the test first.');
  }

  const { questionIds, ...rest } = input;

  const data: Prisma.TestUpdateInput = {};
  if (rest.title) data.title = rest.title;
  if (rest.description !== undefined) data.description = rest.description;
  if (rest.courseId !== undefined) data.course = { connect: { id: rest.courseId } };
  if (rest.durationMinutes !== undefined) data.durationMinutes = rest.durationMinutes;
  if (rest.totalMarks !== undefined) data.totalMarks = new Prisma.Decimal(rest.totalMarks);
  if (rest.passingMarks !== undefined) data.passingMarks = new Prisma.Decimal(rest.passingMarks);
  if (rest.negativeMarks !== undefined) data.negativeMarks = new Prisma.Decimal(rest.negativeMarks);
  if (rest.maxAttempts !== undefined) data.maxAttempts = rest.maxAttempts;
  if (rest.shuffleQuestions !== undefined) data.shuffleQuestions = rest.shuffleQuestions;
  if (rest.randomOptionOrder !== undefined) data.randomOptionOrder = rest.randomOptionOrder;
  if (rest.showResultImmediately !== undefined) data.showResultImmediately = rest.showResultImmediately;
  if (rest.examMode !== undefined) data.examMode = rest.examMode as any;
  if (rest.password !== undefined) data.password = rest.password;
  if (rest.gracePeriodMinutes !== undefined) data.gracePeriodMinutes = rest.gracePeriodMinutes;
  data.startAt = rest.startAt !== undefined ? dateOrUndef(rest.startAt) : test.startAt;
  data.endAt = rest.endAt !== undefined ? dateOrUndef(rest.endAt) : test.endAt;

  if (questionIds) {
    const questions = await getQuestionIds(questionIds);
    if (rest.totalMarks === undefined) {
      data.totalMarks = new Prisma.Decimal(questions.reduce((sum, q) => sum + Number(q.marks), 0));
    }
    await prisma.testQuestion.deleteMany({ where: { testId: id } });
    data.testQuestions = {
      create: questionIds.map((qid, i) => ({ questionId: qid, orderIndex: i })),
    };
  }

  return prisma.test.update({ where: { id }, data });
};

export const setTestStatus = async (id: string, viewer: { id: string; role: string }, status: TestStatus) => {
  const test = await prisma.test.findUnique({ where: { id }, select: { createdById: true } });
  if (!test) throw new AppError(404, 'Test not found');
  if (viewer.role !== Role.ADMIN && test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');
  return prisma.test.update({ where: { id }, data: { status } });
};

export const assignTest = async (id: string, viewer: { id: string; role: string }, input: AssignTestInput) => {
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) throw new AppError(404, 'Test not found');
  if (viewer.role !== Role.ADMIN && test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');

  const students = await prisma.user.findMany({
    where: { id: { in: input.studentIds }, role: Role.STUDENT },
    select: { id: true },
  });
  if (students.length !== new Set(input.studentIds).size) {
    throw new AppError(400, 'One or more student ids are invalid');
  }

  const existing = await prisma.testAssignment.findMany({
    where: { testId: id, studentId: { in: input.studentIds } },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((a) => a.studentId));
  const toCreate = input.studentIds.filter((sid) => !existingIds.has(sid));

  if (toCreate.length > 0) {
    await prisma.testAssignment.createMany({
      data: toCreate.map((studentId) => ({ testId: id, studentId })),
      skipDuplicates: true,
    });

    // Send notifications to newly assigned students
    const test = await prisma.test.findUnique({ where: { id }, select: { title: true } });
    if (test) {
      await createManyNotifications(
        toCreate.map((studentId) => ({
          userId: studentId,
          type: 'TEST_ASSIGNED',
          title: `New test assigned: ${test.title}`,
          message: `You have been assigned a new test "${test.title}". Check your test dashboard.`,
        })),
      );
    }
  }

  return { assigned: toCreate.length };
};

export const listAssignedStudents = async (id: string) => {
  const assignments = await prisma.testAssignment.findMany({
    where: { testId: id },
    include: { student: { select: { id: true, fullName: true, email: true, username: true } } },
  });
  return assignments.map((a) => a.student);
};

export const listStudentsForAssignment = async (search?: string) => {
  const where: Prisma.UserWhereInput = { role: Role.STUDENT };
  if (search && search.trim()) {
    where.OR = [
      { email: { contains: search.trim() } },
      { username: { contains: search.trim() } },
      { fullName: { contains: search.trim() } },
    ];
  }
  return prisma.user.findMany({
    where,
    select: { id: true, fullName: true, email: true, username: true },
    orderBy: { email: 'asc' },
    take: 100,
  });
};

export const deleteTest = async (id: string, viewer: { id: string; role: string }) => {
  const test = await prisma.test.findUnique({ where: { id }, select: { createdById: true } });
  if (!test) throw new AppError(404, 'Test not found');
  if (viewer.role !== Role.ADMIN && test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');
  await prisma.test.delete({ where: { id } });
};
