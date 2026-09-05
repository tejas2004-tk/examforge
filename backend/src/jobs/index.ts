import { prisma } from '../config/database.js';
import { registerJob, scheduleJob } from './queue.js';

export function registerJobs() {
  // Cleanup expired verification tokens
  registerJob('cleanup:verification-tokens', async () => {
    await prisma.verificationToken.deleteMany({
      where: { expiresAt: { lt: new Date() }, usedAt: null },
    });
  });

  // Close tests past their end date
  registerJob('tests:auto-close', async () => {
    await prisma.test.updateMany({
      where: { status: 'PUBLISHED', endAt: { lt: new Date() } },
      data: { status: 'CLOSED' },
    });
  });

  // Recalculate leaderboards periodically
  registerJob('leaderboard:recalculate', async () => {
    const courses = await prisma.course.findMany({ select: { id: true } });
    for (const course of courses) {
      // Simplified: just update from data
      const attempts = await prisma.attempt.findMany({
        where: { status: 'EVALUATED', score: { not: null }, passed: true, test: { courseId: course.id } },
        include: { student: { select: { id: true } } },
      });
      const stats = new Map<string, { totalScore: number; testsTaken: number; scores: number[] }>();
      for (const a of attempts) {
        const entry = stats.get(a.studentId) ?? { totalScore: 0, testsTaken: 0, scores: [] };
        entry.totalScore += Number(a.score ?? 0);
        entry.testsTaken += 1;
        entry.scores.push(Number(a.percentage ?? 0));
        stats.set(a.studentId, entry);
      }
      const entries = Array.from(stats.entries()).map(([uid, s]) => ({
        uid, ...s, avg: s.scores.reduce((a, b) => a + b, 0) / (s.scores.length || 1),
      })).sort((a, b) => b.totalScore - a.totalScore);

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        await prisma.leaderboard.upsert({
          where: { userId_courseId: { userId: e.uid, courseId: course.id } },
          create: { userId: e.uid, courseId: course.id, totalScore: e.totalScore, testsTaken: e.testsTaken, avgPercentage: e.avg, rank: i + 1 },
          update: { totalScore: e.totalScore, testsTaken: e.testsTaken, avgPercentage: e.avg, rank: i + 1 },
        });
      }
    }
  });

  // Send assignment deadline reminders
  registerJob('notifications:assignment-deadline', async () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const overdue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const assignments = await prisma.assignment.findMany({
      where: { dueAt: { not: null, gte: overdue, lte: soon } },
      include: { course: { include: { enrollments: { where: { status: 'active' } } } } },
    });
    for (const assignment of assignments) {
      for (const enrollment of assignment.course?.enrollments ?? []) {
        await prisma.notification.create({
          data: {
            userId: enrollment.userId,
            type: 'ASSIGNMENT_DEADLINE',
            title: `Assignment deadline approaching: ${assignment.title}`,
            message: `Due ${assignment.dueAt?.toLocaleString()}`,
          },
        });
      }
    }
  });

  // Initial scheduled jobs
  scheduleJob('tests:auto-close', {}, 60_000);
  scheduleJob('leaderboard:recalculate', {}, 5 * 60_000);
  scheduleJob('notifications:assignment-deadline', {}, 5 * 60_000);
  scheduleJob('cleanup:verification-tokens', {}, 30 * 60_000);
}

export default registerJobs;