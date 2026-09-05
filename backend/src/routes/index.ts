import { Router } from 'express';
import { prisma } from '../config/database.js';
import { authRouter } from './auth.routes.js';
import { attemptRouter } from './attempt.routes.js';
import { courseRouter } from './course.routes.js';
import { questionRouter } from './question.routes.js';
import { questionBankRouter } from './questionBank.routes.js';
import { resultRouter } from './result.routes.js';
import { testRouter } from './test.routes.js';
import { userRouter } from './user.routes.js';
import { assignmentRouter } from './assignment.routes.js';
import { notificationRouter } from './notification.routes.js';
import { auditRouter } from './audit.routes.js';
import { classBatchRouter } from './classBatch.routes.js';
import { lmsRouter } from './lms.routes.js';
import { testSectionRouter } from './testSection.routes.js';
import { fileUploadRouter } from './fileUpload.routes.js';
import { certificateRouter, leaderboardRouter } from './certificateLeaderboard.routes.js';
import { codingProblemRouter } from './codingProblem.routes.js';
import { proctoringRouter } from './proctoring.routes.js';
import { organizationRouter } from './organization.routes.js';
import { aiRouter } from './ai.routes.js';
import { searchRouter } from './search.routes.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { metricsHandler } from '../monitoring/metrics.js';
import { listAssignedTests } from '../controllers/attempt.controller.js';
import { AppError } from '../utils/errors.js';

export const apiRouter = Router();

apiRouter.get('/tests/assigned', requireAuth, (req, res, next) => {
  if (req.user?.role !== 'STUDENT') {
    next(new AppError(403, 'Student role required'));
    return;
  }
  listAssignedTests(req, res, next);
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/courses', courseRouter);
apiRouter.use('/questions', questionRouter);
apiRouter.use('/question-banks', questionBankRouter);
apiRouter.use('/assignments', assignmentRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/class-batches', classBatchRouter);
apiRouter.use(lmsRouter);
apiRouter.use(testSectionRouter);
apiRouter.use('/files', fileUploadRouter);
apiRouter.use('/coding-problems', codingProblemRouter);
apiRouter.use('/proctoring', proctoringRouter);
apiRouter.use('/organizations', organizationRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/certificates', certificateRouter);
apiRouter.use('/leaderboards', leaderboardRouter);
// Student attempt routes must precede testRouter so GET /tests/assigned and
// POST /tests/:testId/start are not shadowed by GET /tests/:id.
apiRouter.use(attemptRouter);
apiRouter.use('/tests', testRouter);
apiRouter.use('/results', resultRouter);

apiRouter.get('/health', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }
  res.json({
    success: true,
    data: {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { status: 'ok' } });
  } catch {
    res.status(503).json({ success: false, data: { status: 'error' } });
  }
});

apiRouter.get('/health/ai', (_req, res) => {
  const aiConfigured = !!process.env.OPENAI_API_KEY;
  res.json({
    success: true,
    data: {
      status: aiConfigured ? 'configured' : 'not-configured',
      url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
    },
  });
});

// Prometheus metrics
apiRouter.get('/metrics', metricsHandler);

apiRouter.get('/admin/stats', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const [
    totalUsers,
    totalTeachers,
    totalStudents,
    totalProctors,
    totalOrganizations,
    totalCourses,
    totalTests,
    publishedTests,
    totalQuestions,
    totalAttempts,
    evaluatedAttempts,
    passedAttempts,
    totalAssignments,
    totalSubmissions,
    totalCodingProblems,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'PROCTOR' } }),
    prisma.organization.count(),
    prisma.course.count(),
    prisma.test.count(),
    prisma.test.count({ where: { status: 'PUBLISHED' } }),
    prisma.question.count(),
    prisma.attempt.count({ where: { status: { not: 'IN_PROGRESS' } } }),
    prisma.attempt.count({ where: { status: 'EVALUATED' } }),
    prisma.attempt.count({ where: { passed: true } }),
    prisma.assignment.count(),
    prisma.assignmentSubmission.count(),
    prisma.codingProblem.count(),
  ]);

  const avgScore = await prisma.attempt.aggregate({
    where: { status: 'EVALUATED', score: { not: null } },
    _avg: { score: true, percentage: true },
  });

  res.json({
    success: true,
    data: {
      totalUsers,
      totalTeachers,
      totalStudents,
      totalProctors,
      totalOrganizations,
      totalCourses,
      totalTests,
      publishedTests,
      totalQuestions,
      totalAttempts,
      evaluatedAttempts,
      passedAttempts,
      totalAssignments,
      totalSubmissions,
      totalCodingProblems,
      avgScore: avgScore._avg.score ? Number(avgScore._avg.score) : null,
      avgPercentage: avgScore._avg.percentage ? Number(avgScore._avg.percentage) : null,
    },
  });
});