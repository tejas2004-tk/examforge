import { AttemptStatus, Prisma, QuestionType, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import { recomputeAttemptScore } from './evaluation.service.js';

const MANUAL_TYPES = [QuestionType.SUBJECTIVE, QuestionType.CODING];

const serializeAttempt = (attempt: {
  id: string;
  score: Prisma.Decimal | null;
  percentage: Prisma.Decimal | null;
  passed: boolean | null;
  status: AttemptStatus;
  timeTakenSeconds: number | null;
  submittedAt: Date | null;
  suspiciousEvents: Prisma.JsonValue | null;
  startedAt: Date;
  test: { id: string; title: string; course?: { name: string } | null; totalMarks: Prisma.Decimal; passingMarks: Prisma.Decimal; negativeMarks: Prisma.Decimal };
  student?: { id: string; fullName: string | null; email: string };
}) => ({
  id: attempt.id,
  status: attempt.status,
  score: attempt.score === null ? null : Number(attempt.score),
  percentage: attempt.percentage === null ? null : Number(attempt.percentage),
  passed: attempt.passed,
  timeTakenSeconds: attempt.timeTakenSeconds,
  startedAt: attempt.startedAt,
  submittedAt: attempt.submittedAt,
  suspiciousEventCount: Array.isArray(attempt.suspiciousEvents) ? attempt.suspiciousEvents.length : 0,
  test: {
    id: attempt.test.id,
    title: attempt.test.title,
    course: attempt.test.course?.name ?? null,
    totalMarks: Number(attempt.test.totalMarks),
    passingMarks: Number(attempt.test.passingMarks),
    negativeMarks: Number(attempt.test.negativeMarks),
  },
  ...(attempt.student ? { student: attempt.student } : {}),
});

const baseInclude = {
  test: {
    include: { course: { select: { name: true } } },
  },
} satisfies Prisma.AttemptInclude;

export const listResultsForStudent = async (studentId: string, query: Record<string, unknown>) => {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.AttemptWhereInput = {
    studentId,
    status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED] },
  };

  const [items, total] = await Promise.all([
    prisma.attempt.findMany({ where, include: baseInclude, orderBy: { submittedAt: 'desc' }, skip, take: limit }),
    prisma.attempt.count({ where }),
  ]);

  return {
    items: items.map(serializeAttempt),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const listSubmissions = async (viewer: { id: string; role: string }, query: Record<string, unknown>) => {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.AttemptWhereInput = {
    status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED] },
  };
  if (viewer.role === Role.TEACHER) {
    where.test = { createdById: viewer.id };
  }
  if (typeof query.testId === 'string') where.testId = query.testId;
  if (typeof query.search === 'string' && query.search.trim()) {
    where.student = {
      OR: [
        { email: { contains: query.search.trim() } },
        { fullName: { contains: query.search.trim() } },
      ],
    };
  }

  const include: Prisma.AttemptInclude = {
    ...baseInclude,
    student: { select: { id: true, fullName: true, email: true } },
  };

  const [items, total] = await Promise.all([
    prisma.attempt.findMany({ where, include, orderBy: { submittedAt: 'desc' }, skip, take: limit }),
    prisma.attempt.count({ where }),
  ]);

  return {
    items: items.map(serializeAttempt),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getResultDetail = async (attemptId: string, viewer: { id: string; role: string }) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { include: { course: true, testQuestions: { include: { question: { include: { options: true } } } } } },
      student: { select: { id: true, fullName: true, email: true } },
      answers: true,
    },
  });
  if (!attempt) throw new AppError(404, 'Result not found');
  if (attempt.status === AttemptStatus.IN_PROGRESS) throw new AppError(400, 'This attempt has not been submitted');

  const isOwner = viewer.role === Role.STUDENT && attempt.studentId === viewer.id;
  const isTeacher = viewer.role === Role.TEACHER && attempt.test.createdById === viewer.id;
  const isAdmin = viewer.role === Role.ADMIN;
  if (!isOwner && !isTeacher && !isAdmin) throw new AppError(403, 'You cannot view this result');

  const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const questions = attempt.test.testQuestions
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((tq) => {
      const question = tq.question;
      const answer = answersByQuestion.get(question.id);
      const selectedIds: string[] = [];
      if (answer?.optionId) selectedIds.push(answer.optionId);
      if (answer?.answerJson && typeof answer.answerJson === 'object' && 'optionIds' in answer.answerJson) {
        const ids = (answer.answerJson as { optionIds?: unknown }).optionIds;
        if (Array.isArray(ids)) selectedIds.push(...(ids as string[]));
      }
      return {
        questionId: question.id,
        answerId: answer?.id ?? null,
        type: question.type,
        text: question.text,
        difficulty: question.difficulty,
        marks: Number(question.marks),
        negativeMarks: Number(question.negativeMarks),
        explanation: question.explanation,
        options: question.options
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect,
            selected: selectedIds.includes(o.id),
          })),
        answerJson: answer?.answerJson ?? null,
        isCorrect: answer?.isCorrect ?? null,
        marksObtained: answer?.marksObtained === null || answer?.marksObtained === undefined ? null : Number(answer.marksObtained),
        requiresManualGrading: (MANUAL_TYPES as QuestionType[]).includes(question.type),
      };
    });

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score === null ? null : Number(attempt.score),
      percentage: attempt.percentage === null ? null : Number(attempt.percentage),
      passed: attempt.passed,
      timeTakenSeconds: attempt.timeTakenSeconds,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      suspiciousEvents: Array.isArray(attempt.suspiciousEvents) ? attempt.suspiciousEvents : [],
    },
    test: {
      id: attempt.test.id,
      title: attempt.test.title,
      description: attempt.test.description,
      totalMarks: Number(attempt.test.totalMarks),
      passingMarks: Number(attempt.test.passingMarks),
      negativeMarks: Number(attempt.test.negativeMarks),
      course: attempt.test.course ? { id: attempt.test.course.id, name: attempt.test.course.name } : null,
    },
    student: attempt.student,
    questions,
  };
};

export const gradeAnswer = async (answerId: string, teacherId: string, marks: number) => {
  const answer = await prisma.attemptAnswer.findUnique({
    where: { id: answerId },
    include: { attempt: { include: { test: true } }, question: true },
  });
  if (!answer) throw new AppError(404, 'Answer not found');

  if (answer.attempt.test.createdById !== teacherId) {
    throw new AppError(403, 'Only the test creator can grade answers');
  }
  if (!(MANUAL_TYPES as QuestionType[]).includes(answer.question.type)) {
    throw new AppError(400, 'Only subjective and coding answers can be graded manually');
  }
  if (marks > Number(answer.question.marks)) {
    throw new AppError(400, `Marks cannot exceed ${Number(answer.question.marks)}`);
  }

  await prisma.attemptAnswer.update({
    where: { id: answerId },
    data: { marksObtained: new Prisma.Decimal(marks), isCorrect: true },
  });

  await recomputeAttemptScore(answer.attemptId);
  return { answerId, marks };
};
