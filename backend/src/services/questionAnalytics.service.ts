import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function getQuestionAnalytics(questionId: string) {
  const analytics = await prisma.questionAnalytics.findUnique({ where: { questionId } });
  if (!analytics) {
    return { questionId, attemptCount: 0, correctCount: 0, incorrectCount: 0, accuracy: 0, avgTimeSeconds: 0, discriminationIndex: 0 };
  }
  return analytics;
}

export async function recalculateQuestionAnalytics(questionId: string) {
  const answers = await prisma.attemptAnswer.findMany({
    where: { questionId, isCorrect: { not: null } },
    select: { isCorrect: true, marksObtained: true, timeSpentSeconds: true },
  });

  const attemptCount = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const incorrectCount = answers.filter((a) => a.isCorrect === false).length;
  const accuracy = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 10000) / 100 : 0;
  const timeValues = answers
    .map((a) => a.timeSpentSeconds)
    .filter((t): t is number => t !== null && t !== undefined);
  const avgTimeSeconds = timeValues.length > 0
    ? Math.round((timeValues.reduce((a, b) => a + b, 0) / timeValues.length) * 100) / 100
    : 0;

  // Compute discrimination index using upper/lower terciles
  let discriminationIndex = 0;
  if (attemptCount >= 6) {
    // Get scores of students who answered this question across attempts
    const attemptAnswers = await prisma.attemptAnswer.findMany({
      where: { questionId },
      include: {
        attempt: { select: { studentId: true, score: true } },
      },
    });

    // Build per-student: answered correct? + total score
    const studentStats = new Map<string, { correct: boolean; score: number }>();
    for (const aa of attemptAnswers) {
      const existing = studentStats.get(aa.attempt.studentId) ?? { correct: false, score: 0 };
      if (aa.isCorrect === true) existing.correct = true;
      if (aa.attempt.score !== null) existing.score = Number(aa.attempt.score);
      studentStats.set(aa.attempt.studentId, existing);
    }

    const stats = Array.from(studentStats.values());
    if (stats.length >= 6) {
      const sorted = stats.sort((a, b) => b.score - a.score);
      const third = Math.floor(sorted.length / 3);
      const upper = sorted.slice(0, third);
      const lower = sorted.slice(-third);
      const upperCorrect = upper.filter((s) => s.correct).length;
      const lowerCorrect = lower.filter((s) => s.correct).length;
      if (third > 0 && upperCorrect >= 0 && lowerCorrect >= 0) {
        discriminationIndex = (upperCorrect - lowerCorrect) / third;
        discriminationIndex = Math.round(discriminationIndex * 100) / 100;
      }
    }
  }

  return prisma.questionAnalytics.upsert({
    where: { questionId },
    create: {
      questionId,
      attemptCount,
      correctCount,
      incorrectCount,
      accuracy,
      avgTimeSeconds,
      discriminationIndex,
    },
    update: {
      attemptCount,
      correctCount,
      incorrectCount,
      accuracy,
      avgTimeSeconds,
      discriminationIndex,
      updatedAt: new Date(),
    },
  });
}

export async function recalculateAllQuestionAnalytics() {
  const questions = await prisma.question.findMany({ select: { id: true } });
  let count = 0;
  for (const q of questions) {
    await recalculateQuestionAnalytics(q.id);
    count++;
  }
  return { updated: count };
}

export async function getQuestionAnalyticsDashboard() {
  const questions = await prisma.question.findMany({
    include: { analytics: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const topDifficult = questions
    .filter((q) => q.analytics && q.analytics.attemptCount >= 5)
    .sort((a, b) => (a.analytics?.accuracy ?? 100) - (b.analytics?.accuracy ?? 100))
    .slice(0, 10)
    .map((q) => ({
      id: q.id,
      text: q.text.substring(0, 80),
      type: q.type,
      difficulty: q.difficulty,
      accuracy: q.analytics?.accuracy ?? 0,
      attemptCount: q.analytics?.attemptCount ?? 0,
      discriminationIndex: q.analytics?.discriminationIndex ?? 0,
      avgTimeSeconds: q.analytics?.avgTimeSeconds ?? 0,
    }));

  const topAccurate = questions
    .filter((q) => q.analytics && q.analytics.attemptCount >= 5)
    .sort((a, b) => (b.analytics?.accuracy ?? 0) - (a.analytics?.accuracy ?? 0))
    .slice(0, 10)
    .map((q) => ({
      id: q.id,
      text: q.text.substring(0, 80),
      type: q.type,
      difficulty: q.difficulty,
      accuracy: q.analytics?.accuracy ?? 0,
      attemptCount: q.analytics?.attemptCount ?? 0,
      discriminationIndex: q.analytics?.discriminationIndex ?? 0,
      avgTimeSeconds: q.analytics?.avgTimeSeconds ?? 0,
    }));

  const byDifficulty = await prisma.question.groupBy({
    by: ['difficulty'],
    _count: true,
  });

  const byType = await prisma.question.groupBy({
    by: ['type'],
    _count: true,
  });

  const totalAttempts = await prisma.attemptAnswer.count({ where: { isCorrect: { not: null } } });
  const totalCorrect = await prisma.attemptAnswer.count({ where: { isCorrect: true } });

  return {
    totalQuestions: questions.length,
    overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 10000) / 100 : 0,
    totalAttempts,
    byDifficulty: byDifficulty.map((d) => ({ difficulty: d.difficulty, count: d._count })),
    byType: byType.map((t) => ({ type: t.type, count: t._count })),
    topDifficult,
    topAccurate,
  };
}

export async function createQuestionVersion(questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: true, tags: true },
  });
  if (!question) throw new AppError(404, 'Question not found');

  const maxVersion = await prisma.questionVersion.aggregate({ where: { questionId }, _max: { version: true } });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  return prisma.questionVersion.create({
    data: {
      questionId,
      version: nextVersion,
      text: question.text,
      data: {
        type: question.type,
        difficulty: question.difficulty,
        bloomLevel: question.bloomLevel,
        marks: Number(question.marks),
        negativeMarks: Number(question.negativeMarks),
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
        options: question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, orderIndex: o.orderIndex })),
        tags: question.tags.map((t) => t.tag),
        topic: question.topic,
        subtopic: question.subtopic,
      },
    },
  });
}

export async function getQuestionVersions(questionId: string) {
  return prisma.questionVersion.findMany({
    where: { questionId },
    orderBy: { version: 'desc' },
  });
}