import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function recalculateLeaderboard(courseId?: string) {
  const where: any = {};
  if (courseId) where.courseId = courseId;

  const attempts = await prisma.attempt.findMany({
    where: { status: 'EVALUATED', score: { not: null }, passed: true, ...where },
    include: { student: { select: { id: true } } },
  });

  const stats = new Map<string, { totalScore: number; testsTaken: number; scores: number[] }>();

  for (const attempt of attempts) {
    const studentId = attempt.studentId;
    const score = Number(attempt.score ?? 0);
    const pct = Number(attempt.percentage ?? 0);

    const entry = stats.get(studentId) ?? { totalScore: 0, testsTaken: 0, scores: [] };
    entry.totalScore += score;
    entry.testsTaken += 1;
    entry.scores.push(pct);
    stats.set(studentId, entry);
  }

  const entries = Array.from(stats.entries()).map(([userId, s]) => ({
    userId,
    courseId: courseId ?? null,
    totalScore: s.totalScore,
    testsTaken: s.testsTaken,
    avgPercentage: s.scores.length > 0 ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : 0,
  }));

  entries.sort((a, b) => b.totalScore - a.totalScore);
  entries.forEach((e, i) => { (e as any).rank = i + 1; });

  for (const entry of entries) {
    await prisma.leaderboard.upsert({
      where: { userId_courseId: { userId: entry.userId, courseId: courseId ?? '' } },
      create: {
        userId: entry.userId,
        courseId: courseId ?? undefined,
        totalScore: entry.totalScore,
        testsTaken: entry.testsTaken,
        avgPercentage: entry.avgPercentage,
        rank: (entry as any).rank,
      },
      update: {
        totalScore: entry.totalScore,
        testsTaken: entry.testsTaken,
        avgPercentage: entry.avgPercentage,
        rank: (entry as any).rank,
      },
    });
  }

  return { updated: entries.length };
}

export async function getLeaderboard(courseId?: string, limit: number = 50) {
  const where: any = {};
  if (courseId) where.courseId = courseId;

  return prisma.leaderboard.findMany({
    where,
    include: { user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { rank: 'asc' },
    take: limit,
  });
}

export async function getMyRank(userId: string, courseId?: string) {
  const where: any = { userId };
  if (courseId) where.courseId = courseId;

  const entry = await prisma.leaderboard.findFirst({
    where,
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  if (!entry) return null;

  const totalParticipants = await prisma.leaderboard.count({
    where: courseId ? { courseId } : {},
  });

  return {
    ...entry,
    totalParticipants,
    percentile: totalParticipants > 0 ? ((totalParticipants - entry.rank) / totalParticipants) * 100 : 0,
  };
}
