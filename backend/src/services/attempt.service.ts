import { AttemptStatus, Prisma, QuestionType, TestStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { evaluateAttempt } from './evaluation.service.js';
import type { SaveAnswerInput, SuspiciousEventInput } from '../schemas/attempt.schema.js';

const OPTION_TYPES = new Set<QuestionType>([QuestionType.SINGLE, QuestionType.MULTIPLE, QuestionType.TRUE_FALSE]);
const SUSPICIOUS_TYPES = new Set(['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY', 'PASTE', 'CONTEXT_MENU', 'WINDOW_RESIZE']);
const SEVERITY_WEIGHT: Record<string, number> = { TAB_SWITCH: 10, WINDOW_BLUR: 5, FULLSCREEN_EXIT: 10, COPY: 10, PASTE: 10, CONTEXT_MENU: 2, WINDOW_RESIZE: 2 };

interface TestWindow {
  durationMinutes: number;
  startAt: Date | null;
  endAt: Date | null;
}

const hasAssignment = async (testId: string, studentId: string): Promise<boolean> => {
  const assignment = await prisma.testAssignment.findFirst({
    where: {
      testId,
      OR: [
        { studentId },
        { class: { students: { some: { studentId } } } },
      ],
    },
  });
  return Boolean(assignment);
};

const ensureInWindow = (test: TestWindow, now: Date) => {
  if (test.startAt && now < test.startAt) {
    throw new AppError(403, 'This test has not started yet');
  }
  if (test.endAt && now > test.endAt) {
    throw new AppError(403, 'This test window has ended');
  }
};

const deadlineOf = (attempt: { startedAt: Date }, test: TestWindow): Date =>
  new Date(Math.min(
    attempt.startedAt.getTime() + test.durationMinutes * 60 * 1000,
    test.endAt ? test.endAt.getTime() : Infinity,
  ));

const ensureActive = async (attemptId: string): Promise<{ attempt: Awaited<ReturnType<typeof loadAttemptOwned>>; test: TestWindow }> => {
  const attempt = await loadAttemptOwned(attemptId);
  const test = await prisma.test.findUnique({ where: { id: attempt.testId } });
  if (!test) throw new AppError(404, 'Test not found');

  const active = attempt.status === AttemptStatus.IN_PROGRESS;
  if (!active) throw new AppError(400, 'This attempt is already submitted');

  const deadline = deadlineOf(attempt, test);
  if (Date.now() > deadline.getTime()) {
    const result = await finalize(attempt.id);
    throw new AppError(409, 'TIME_UP', { attemptId: result.attemptId });
  }
  return { attempt, test };
};

const loadAttemptOwned = async (attemptId: string) => {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new AppError(404, 'Attempt not found');
  return attempt;
};

export const sanitizedQuestion = (question: {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: string;
  marks: Prisma.Decimal;
  negativeMarks: Prisma.Decimal;
  options: { id: string; text: string; orderIndex: number }[];
}) => ({
  id: question.id,
  text: question.text,
  type: question.type,
  difficulty: question.difficulty,
  marks: Number(question.marks),
  negativeMarks: Number(question.negativeMarks),
  options: question.options
    .map((o) => ({ id: o.id, text: o.text }))
    .sort(() => Math.random() - 0.5),
});

const buildAttemptPayload = async (attempt: { id: string; studentId: string; testId: string }) => {
  const [test, savedAnswers, attemptRow] = await Promise.all([
    prisma.test.findUnique({
      where: { id: attempt.testId },
      include: {
        course: { select: { id: true, name: true } },
        testQuestions: {
          include: {
            question: {
              include: { options: { select: { id: true, text: true, orderIndex: true } } },
            },
          },
        },
      },
    }),
    prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    prisma.attempt.findUnique({ where: { id: attempt.id } }),
  ]);
  if (!test || !attemptRow) throw new AppError(404, 'Attempt data not found');

  const now = new Date();
  const deadline = new Date(Math.min(
    attemptRow.startedAt.getTime() + test.durationMinutes * 60 * 1000,
    test.endAt ? test.endAt.getTime() : Infinity,
  ));

  const questions = test.testQuestions
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const items = test.shuffleQuestions
    ? questions.map((tq) => tq).sort(() => Math.random() - 0.5)
    : questions;

  return {
    attempt: {
      id: attempt.id,
      status: attemptRow.status,
      startedAt: attemptRow.startedAt,
      serverNow: now,
      deadline,
      remainingSeconds: Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000)),
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        durationMinutes: test.durationMinutes,
        totalMarks: Number(test.totalMarks),
        passingMarks: Number(test.passingMarks),
        negativeMarks: Number(test.negativeMarks),
        showResultImmediately: test.showResultImmediately,
        course: test.course ? { id: test.course.id, name: test.course.name } : undefined,
      },
    },
    questions: items.map((tq) => ({
      orderIndex: tq.orderIndex,
      question: sanitizedQuestion(tq.question),
    })),
    answers: savedAnswers.map((a) => ({
      questionId: a.questionId,
      optionId: a.optionId,
      answerJson: a.answerJson,
    })),
  };
};

export const startAttempt = async (studentId: string, testId: string) => {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(404, 'Test not found');
  if (test.status !== TestStatus.PUBLISHED) {
    throw new AppError(403, 'This test is not published');
  }

  const now = new Date();
  ensureInWindow(test, now);

  const assigned = await hasAssignment(testId, studentId);
  if (!assigned) throw new AppError(403, 'This test has not been assigned to you');

  // Resume an existing in-progress attempt.
  const existing = await prisma.attempt.findFirst({
    where: { studentId, testId, status: AttemptStatus.IN_PROGRESS },
  });
  if (existing) return buildAttemptPayload(existing);

  const finishedCount = await prisma.attempt.count({
    where: { studentId, testId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED] } },
  });
  if (finishedCount >= test.maxAttempts) {
    throw new AppError(403, 'You have exhausted the allowed attempts for this test');
  }

  const attempt = await prisma.attempt.create({
    data: { studentId, testId, status: AttemptStatus.IN_PROGRESS, suspiciousEvents: [] },
  });

  return buildAttemptPayload(attempt);
};

export const getAttempt = async (attemptId: string, studentId: string) => {
  const attempt = await loadAttemptOwned(attemptId);
  if (attempt.studentId !== studentId) throw new AppError(403, 'Not your attempt');

  const test = await prisma.test.findUnique({ where: { id: attempt.testId } });
  if (!test) throw new AppError(404, 'Test not found');

  // Allow resume only while still active; submitted attempts go through results.
  if (attempt.status === AttemptStatus.IN_PROGRESS && Date.now() > deadlineOf(attempt, test).getTime()) {
    await finalize(attempt.id);
    throw new AppError(409, 'TIME_UP', { attemptId: attempt.id });
  }

  return buildAttemptPayload(attempt);
};

export const saveAnswer = async (
  attemptId: string,
  studentId: string,
  input: SaveAnswerInput,
) => {
  const { attempt } = await ensureActive(attemptId);
  if (attempt.studentId !== studentId) throw new AppError(403, 'Not your attempt');

  const tq = await prisma.testQuestion.findUnique({
    where: { testId_questionId: { testId: attempt.testId, questionId: input.questionId } },
  });
  if (!tq) throw new AppError(400, 'Question does not belong to this test');

  const answerJson = input.answerJson !== undefined ? (input.answerJson as Prisma.InputJsonValue) : Prisma.JsonNull;

  const existing = await prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
  });
  const startedAt = existing?.updatedAt ?? new Date();
  const timeSpent = input.timeSpentSeconds ?? Math.floor((Date.now() - startedAt.getTime()) / 1000);

  const saved = await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
    update: {
      optionId: input.optionId ?? null,
      answerJson,
      timeSpentSeconds: timeSpent,
      updatedAt: new Date(),
    },
    create: {
      attemptId: attempt.id,
      questionId: input.questionId,
      optionId: input.optionId ?? null,
      answerJson,
      timeSpentSeconds: timeSpent,
    },
  });

  return saved;
};

export const logSuspiciousEvent = async (
  attemptId: string,
  studentId: string,
  input: SuspiciousEventInput,
) => {
  const attempt = await loadAttemptOwned(attemptId);
  if (attempt.studentId !== studentId) throw new AppError(403, 'Not your attempt');
  if (!SUSPICIOUS_TYPES.has(input.type)) throw new AppError(400, 'Unknown event type');

  const events: Prisma.JsonValue[] = Array.isArray(attempt.suspiciousEvents)
    ? (attempt.suspiciousEvents as Prisma.JsonValue[])
    : [];
  events.push({
    type: input.type,
    details: (input.details ?? {}) as Prisma.JsonValue,
    at: new Date().toISOString(),
  } as unknown as Prisma.JsonValue);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { suspiciousEvents: events },
  });

  // Update proctoring session if exists, and compute suspicion score
  const session = await prisma.proctoringSession.findFirst({
    where: { attemptId, status: 'ACTIVE' },
  });
  let suspicionScore = Math.min(100, events.length * 5);
  if (session) {
    await prisma.proctoringEvent.create({
      data: {
        sessionId: session.id,
        type: input.type,
        severity: input.type === 'COPY' || input.type === 'PASTE' ? 'MEDIUM' : 'LOW',
      },
    });
    const allEvents = await prisma.proctoringEvent.findMany({ where: { sessionId: session.id } });
    suspicionScore = Math.min(100, allEvents.reduce((sum, e) => sum + (SEVERITY_WEIGHT[input.type] ?? 2), 0));
    await prisma.proctoringSession.update({
      where: { id: session.id },
      data: { suspicionScore },
    });
  }
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { suspicionScore },
  });

  return { count: events.length, suspicionScore };
};

export const finalize = async (attemptId: string): Promise<{ attemptId: string; result?: { score: number; percentage: number; passed: boolean } }> => {
  const attempt = await loadAttemptOwned(attemptId);
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    return { attemptId, result: undefined };
  }

  const test = await prisma.test.findUnique({ where: { id: attempt.testId } });
  const startedAt = attempt.startedAt.getTime();
  const timeTaken = test
    ? Math.min(Math.floor((Date.now() - startedAt) / 1000), test.durationMinutes * 60)
    : Math.floor((Date.now() - startedAt) / 1000);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date(), timeTakenSeconds: timeTaken },
  });

  const result = await evaluateAttempt(attemptId);
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: AttemptStatus.EVALUATED },
  });

  return { attemptId, result };
};

export const submitAttempt = async (attemptId: string, studentId: string) => {
  const attempt = await loadAttemptOwned(attemptId);
  if (attempt.studentId !== studentId) throw new AppError(403, 'Not your attempt');
  return finalize(attemptId);
};

export const listAssignedTestsForStudent = async (studentId: string) => {
  const assignments = await prisma.testAssignment.findMany({
    where: {
      OR: [
        { studentId },
        { class: { students: { some: { studentId } } } },
      ],
    },
    select: { testId: true },
  });
  const testIds = [...new Set(assignments.map((a) => a.testId))];

  const tests = await prisma.test.findMany({
    where: { id: { in: testIds }, status: TestStatus.PUBLISHED },
    include: {
      course: { select: { id: true, name: true, code: true } },
      _count: { select: { testQuestions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const attempts = await prisma.attempt.findMany({
    where: { studentId, testId: { in: testIds } },
    orderBy: { submittedAt: 'desc' },
  });

  const finishedByTest = new Map<string, { used: number; bestScore: number | null; lastSubmittedAt: Date | null }>();
  for (const a of attempts) {
    if (a.status === AttemptStatus.IN_PROGRESS) continue;
    const entry = finishedByTest.get(a.testId) ?? { used: 0, bestScore: null, lastSubmittedAt: null };
    entry.used += 1;
    const score = a.score === null ? null : Number(a.score);
    if (score !== null && (entry.bestScore === null || score > entry.bestScore)) entry.bestScore = score;
    if (a.submittedAt && (!entry.lastSubmittedAt || a.submittedAt > entry.lastSubmittedAt)) entry.lastSubmittedAt = a.submittedAt;
    finishedByTest.set(a.testId, entry);
  }

  const now = Date.now();
  return {
    items: tests.map((test) => {
      const stats = finishedByTest.get(test.id) ?? { used: 0, bestScore: null, lastSubmittedAt: null };
      const startAt = test.startAt ? test.startAt.getTime() : null;
      const endAt = test.endAt ? test.endAt.getTime() : null;
      return {
        id: test.id,
        title: test.title,
        description: test.description,
        course: test.course ? { id: test.course.id, name: test.course.name, code: test.course.code } : null,
        durationMinutes: test.durationMinutes,
        totalMarks: Number(test.totalMarks),
        passingMarks: Number(test.passingMarks),
        negativeMarks: Number(test.negativeMarks),
        maxAttempts: test.maxAttempts,
        shuffleQuestions: test.shuffleQuestions,
        questionCount: test._count.testQuestions,
        startAt: test.startAt,
        endAt: test.endAt,
        started: startAt === null || now >= startAt,
        ended: endAt !== null && now > endAt,
        attemptsUsed: stats.used,
        bestScore: stats.bestScore,
        lastSubmittedAt: stats.lastSubmittedAt,
        attemptsLeft: Math.max(0, test.maxAttempts - stats.used),
        canAttempt: (startAt === null || now >= startAt) && (endAt === null || now <= endAt) && stats.used < test.maxAttempts,
      };
    }),
  };
};
