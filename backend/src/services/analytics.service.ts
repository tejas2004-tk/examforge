import { AttemptStatus, Prisma, TestStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { isAdmin } from '../middleware/authorize.js';
import { assertTestOwner, type Viewer } from './access.service.js';
import { cached } from './cache.service.js';

export type AnalyticsRange = '7d' | '30d' | '90d' | '365d';

export const RANGES: Record<AnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

export const parseRange = (value: unknown): AnalyticsRange =>
  typeof value === 'string' && value in RANGES ? (value as AnalyticsRange) : '30d';

const FINISHED: AttemptStatus[] = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED];

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** Ten equal percentage bands, always present so a chart has a stable x-axis. */
export const emptyDistribution = () =>
  Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}-${i * 10 + 10}`, count: 0 }));

const bucketIndex = (percentage: number): number =>
  Math.min(9, Math.max(0, Math.floor(percentage / 10)));

// --- Scoping ---------------------------------------------------------------

/**
 * A teacher's analytics cover only the tests they authored. Administrators get
 * an unrestricted filter. The filter is expressed once and reused by every
 * query below so no single call site can accidentally widen the scope.
 */
const attemptScope = (viewer: Viewer): Prisma.AttemptWhereInput =>
  isAdmin(viewer.role) ? {} : { test: { createdById: viewer.id } };

const testScope = (viewer: Viewer): Prisma.TestWhereInput =>
  isAdmin(viewer.role) ? {} : { createdById: viewer.id };

// --- Overview --------------------------------------------------------------

interface Totals {
  attempts: number;
  avgScore: number;
  passRate: number;
}

const totalsFor = async (
  viewer: Viewer,
  from: Date,
  to: Date,
): Promise<Totals> => {
  const where: Prisma.AttemptWhereInput = {
    ...attemptScope(viewer),
    status: { in: FINISHED },
    submittedAt: { gte: from, lt: to },
  };

  const [aggregate, passed] = await Promise.all([
    prisma.attempt.aggregate({ where, _count: { _all: true }, _avg: { percentage: true } }),
    prisma.attempt.count({ where: { ...where, passed: true } }),
  ]);

  const attempts = aggregate._count._all;
  return {
    attempts,
    avgScore: round(num(aggregate._avg.percentage)),
    passRate: attempts === 0 ? 0 : round((passed / attempts) * 100),
  };
};

interface SeriesRow {
  day: Date | string;
  attempts: bigint | number;
  avgPercentage: Prisma.Decimal | number | null;
  passed: bigint | number;
}

/**
 * Grouping by calendar day is not expressible through Prisma's typed API, so
 * the time series uses a parameterised raw query. A year is bucketed by week to
 * keep the payload proportionate to what a chart can actually render.
 */
const loadSeries = async (viewer: Viewer, from: Date, to: Date, weekly: boolean) => {
  const ownerFilter = isAdmin(viewer.role)
    ? Prisma.empty
    : Prisma.sql`AND t.createdById = ${viewer.id}`;
  const bucket = weekly
    ? Prisma.sql`DATE(DATE_SUB(a.submittedAt, INTERVAL WEEKDAY(a.submittedAt) DAY))`
    : Prisma.sql`DATE(a.submittedAt)`;

  const rows = await prisma.$queryRaw<SeriesRow[]>(Prisma.sql`
    SELECT ${bucket} AS day,
           COUNT(*) AS attempts,
           AVG(a.percentage) AS avgPercentage,
           SUM(a.passed = 1) AS passed
    FROM Attempt a
    JOIN Test t ON t.id = a.testId
    WHERE a.status IN ('SUBMITTED', 'EVALUATED')
      AND a.submittedAt >= ${from}
      AND a.submittedAt < ${to}
      ${ownerFilter}
    GROUP BY day
    ORDER BY day ASC
  `);

  const byDay = new Map<string, { attempts: number; avgScore: number; passRate: number }>();
  for (const row of rows) {
    const key = dayKey(new Date(row.day as string));
    const attempts = num(row.attempts);
    byDay.set(key, {
      attempts,
      avgScore: round(num(row.avgPercentage)),
      passRate: attempts === 0 ? 0 : round((num(row.passed) / attempts) * 100),
    });
  }

  // Gaps are filled so the chart draws a continuous axis rather than skipping days.
  const series: { date: string; attempts: number; avgScore: number; passRate: number }[] = [];
  const step = weekly ? 7 : 1;
  for (let cursor = new Date(from); cursor < to; cursor.setUTCDate(cursor.getUTCDate() + step)) {
    const key = dayKey(cursor);
    const found = byDay.get(key);
    series.push({ date: key, ...(found ?? { attempts: 0, avgScore: 0, passRate: 0 }) });
  }
  return series;
};

interface DistributionRow {
  bucket: number;
  count: bigint | number;
}

const loadDistribution = async (viewer: Viewer, from: Date, to: Date) => {
  const ownerFilter = isAdmin(viewer.role)
    ? Prisma.empty
    : Prisma.sql`AND t.createdById = ${viewer.id}`;

  const rows = await prisma.$queryRaw<DistributionRow[]>(Prisma.sql`
    SELECT LEAST(9, GREATEST(0, FLOOR(a.percentage / 10))) AS bucket, COUNT(*) AS count
    FROM Attempt a
    JOIN Test t ON t.id = a.testId
    WHERE a.status IN ('SUBMITTED', 'EVALUATED')
      AND a.percentage IS NOT NULL
      AND a.submittedAt >= ${from}
      AND a.submittedAt < ${to}
      ${ownerFilter}
    GROUP BY bucket
  `);

  const distribution = emptyDistribution();
  for (const row of rows) {
    const index = Math.min(9, Math.max(0, num(row.bucket)));
    distribution[index].count = num(row.count);
  }
  return distribution;
};

const loadTopTests = async (viewer: Viewer, from: Date, to: Date) => {
  const grouped = await prisma.attempt.groupBy({
    by: ['testId'],
    where: {
      ...attemptScope(viewer),
      status: { in: FINISHED },
      submittedAt: { gte: from, lt: to },
    },
    _count: { _all: true },
    _avg: { percentage: true },
    orderBy: { _count: { testId: 'desc' } },
    take: 5,
  });
  if (grouped.length === 0) return [];

  const testIds = grouped.map((row) => row.testId);
  const [tests, passedCounts] = await Promise.all([
    prisma.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } }),
    prisma.attempt.groupBy({
      by: ['testId'],
      where: {
        testId: { in: testIds },
        status: { in: FINISHED },
        passed: true,
        submittedAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    }),
  ]);

  const titleById = new Map(tests.map((t) => [t.id, t.title]));
  const passedById = new Map(passedCounts.map((row) => [row.testId, row._count._all]));

  return grouped.map((row) => {
    const attempts = row._count._all;
    return {
      id: row.testId,
      title: titleById.get(row.testId) ?? 'Deleted test',
      attempts,
      avgScore: round(num(row._avg.percentage)),
      passRate: attempts === 0 ? 0 : round(((passedById.get(row.testId) ?? 0) / attempts) * 100),
    };
  });
};

const loadRecentActivity = async (viewer: Viewer, from: Date) => {
  const [attempts, tests, enrolments] = await Promise.all([
    prisma.attempt.findMany({
      where: { ...attemptScope(viewer), status: { in: FINISHED }, submittedAt: { gte: from } },
      select: {
        id: true,
        submittedAt: true,
        percentage: true,
        passed: true,
        student: { select: { fullName: true, username: true } },
        test: { select: { title: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 8,
    }),
    prisma.test.findMany({
      where: { ...testScope(viewer), status: TestStatus.PUBLISHED, updatedAt: { gte: from } },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.enrollment.findMany({
      where: isAdmin(viewer.role)
        ? { enrolledAt: { gte: from } }
        : { enrolledAt: { gte: from }, course: { tests: { some: { createdById: viewer.id } } } },
      select: {
        id: true,
        enrolledAt: true,
        user: { select: { fullName: true, username: true } },
        course: { select: { name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      take: 5,
    }),
  ]);

  const named = (user: { fullName: string | null; username: string }) => user.fullName ?? user.username;

  const items = [
    ...attempts.map((a) => ({
      id: `attempt:${a.id}`,
      type: 'attempt' as const,
      message: `${named(a.student)} scored ${round(num(a.percentage), 1)}% on ${a.test.title}${a.passed === false ? ' (below the pass mark)' : ''}`,
      at: a.submittedAt ?? new Date(),
    })),
    ...tests.map((t) => ({
      id: `test:${t.id}`,
      type: 'test' as const,
      message: `${t.title} is published`,
      at: t.updatedAt,
    })),
    ...enrolments.map((e) => ({
      id: `enrolment:${e.id}`,
      type: 'enrolment' as const,
      message: `${named(e.user)} enrolled in ${e.course.name}`,
      at: e.enrolledAt,
    })),
  ];

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 12);
};

export const getOverview = async (viewer: Viewer, rangeInput: unknown) => {
  const range = parseRange(rangeInput);
  const days = RANGES[range];
  const to = new Date();
  const from = startOfDay(new Date(to.getTime() - days * 24 * 60 * 60 * 1000));
  // The comparison window is the equally long period immediately before this one.
  const previousFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

  const cacheKey = `analytics:overview:${viewer.role}:${viewer.id}:${range}:${dayKey(to)}:${to.getUTCHours()}`;

  return cached(cacheKey, 120, async () => {
    const [current, previous, series, scoreDistribution, topTests, recentActivity, activeStudents, publishedTests] =
      await Promise.all([
        totalsFor(viewer, from, to),
        totalsFor(viewer, previousFrom, from),
        loadSeries(viewer, from, to, days > 90),
        loadDistribution(viewer, from, to),
        loadTopTests(viewer, from, to),
        loadRecentActivity(viewer, from),
        prisma.attempt
          .groupBy({
            by: ['studentId'],
            where: { ...attemptScope(viewer), status: { in: FINISHED }, submittedAt: { gte: from } },
          })
          .then((rows) => rows.length),
        prisma.test.count({ where: { ...testScope(viewer), status: TestStatus.PUBLISHED } }),
      ]);

    return {
      range,
      kpis: {
        attempts: current.attempts,
        avgScore: current.avgScore,
        passRate: current.passRate,
        activeStudents,
        publishedTests,
        deltaAttempts: current.attempts - previous.attempts,
        deltaAvgScore: round(current.avgScore - previous.avgScore),
        deltaPassRate: round(current.passRate - previous.passRate),
      },
      series,
      scoreDistribution,
      topTests,
      recentActivity,
    };
  });
};

// --- Per-test psychometrics -------------------------------------------------

/**
 * Classical item analysis on the upper and lower 27% of scorers — the split
 * Kelley showed maximises the stability of the discrimination estimate. Groups
 * are capped so a very large cohort cannot produce an unbounded `IN` list.
 */
const GROUP_FRACTION = 0.27;
const MAX_GROUP_SIZE = 2000;

const median = (sorted: number[]): number => {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const getTestAnalytics = async (testId: string, viewer: Viewer) => {
  await assertTestOwner(testId, viewer);

  const full = await prisma.test.findUniqueOrThrow({
    where: { id: testId },
    select: { id: true, title: true, totalMarks: true, passingMarks: true },
  });

  const finishedWhere: Prisma.AttemptWhereInput = { testId, status: { in: FINISHED } };

  const [aggregate, completed, passed, totalAttempts, distributionRows, percentileRows] =
    await Promise.all([
      prisma.attempt.aggregate({
        where: finishedWhere,
        _count: { _all: true },
        _avg: { score: true, percentage: true, timeTakenSeconds: true },
        _max: { percentage: true },
        _min: { percentage: true },
      }),
      prisma.attempt.count({ where: { testId, status: AttemptStatus.EVALUATED } }),
      prisma.attempt.count({ where: { ...finishedWhere, passed: true } }),
      prisma.attempt.count({ where: { testId } }),
      prisma.$queryRaw<DistributionRow[]>(Prisma.sql`
        SELECT LEAST(9, GREATEST(0, FLOOR(percentage / 10))) AS bucket, COUNT(*) AS count
        FROM Attempt
        WHERE testId = ${testId} AND status IN ('SUBMITTED', 'EVALUATED') AND percentage IS NOT NULL
        GROUP BY bucket
      `),
      // Only the percentage column is read, so the median never materialises rows.
      prisma.attempt.findMany({
        where: { ...finishedWhere, percentage: { not: null } },
        select: { percentage: true },
        orderBy: { percentage: 'asc' },
      }),
    ]);

  const attempts = aggregate._count._all;
  const distribution = emptyDistribution();
  for (const row of distributionRows) {
    distribution[Math.min(9, Math.max(0, num(row.bucket)))].count = num(row.count);
  }

  const percentages = percentileRows.map((row) => num(row.percentage));

  const questionStats = await loadQuestionStats(testId, attempts);

  return {
    test: {
      id: full.id,
      title: full.title,
      totalMarks: num(full.totalMarks),
      passingMarks: num(full.passingMarks),
    },
    summary: {
      attempts,
      completed,
      avgScore: round(num(aggregate._avg.score)),
      avgPercentage: round(num(aggregate._avg.percentage)),
      passRate: attempts === 0 ? 0 : round((passed / attempts) * 100),
      avgDurationSec: Math.round(num(aggregate._avg.timeTakenSeconds)),
      highest: round(num(aggregate._max.percentage)),
      lowest: attempts === 0 ? 0 : round(num(aggregate._min.percentage)),
      median: round(median(percentages)),
      inProgress: Math.max(0, totalAttempts - attempts),
    },
    scoreDistribution: distribution,
    questionStats,
  };
};

const loadQuestionStats = async (testId: string, attemptCount: number) => {
  const testQuestions = await prisma.testQuestion.findMany({
    where: { testId },
    select: {
      orderIndex: true,
      question: { select: { id: true, text: true, type: true } },
    },
    orderBy: { orderIndex: 'asc' },
  });
  if (testQuestions.length === 0) return [];

  const groupSize = Math.min(MAX_GROUP_SIZE, Math.max(1, Math.round(attemptCount * GROUP_FRACTION)));
  const scored: Prisma.AttemptWhereInput = {
    testId,
    status: { in: FINISHED },
    percentage: { not: null },
  };

  const [upper, lower] = attemptCount >= 4
    ? await Promise.all([
        prisma.attempt.findMany({
          where: scored,
          select: { id: true },
          orderBy: [{ percentage: 'desc' }, { id: 'asc' }],
          take: groupSize,
        }),
        prisma.attempt.findMany({
          where: scored,
          select: { id: true },
          orderBy: [{ percentage: 'asc' }, { id: 'desc' }],
          take: groupSize,
        }),
      ])
    : [[], []];

  const upperIds = upper.map((a) => a.id);
  const lowerIds = lower.map((a) => a.id);

  const answered: Prisma.AttemptAnswerWhereInput = {
    attempt: { testId, status: { in: FINISHED } },
  };

  const [overall, correct, upperCorrect, lowerCorrect] = await Promise.all([
    prisma.attemptAnswer.groupBy({
      by: ['questionId'],
      where: answered,
      _count: { _all: true },
      _avg: { timeSpentSeconds: true },
    }),
    prisma.attemptAnswer.groupBy({
      by: ['questionId'],
      where: { ...answered, isCorrect: true },
      _count: { _all: true },
    }),
    upperIds.length > 0
      ? prisma.attemptAnswer.groupBy({
          by: ['questionId'],
          where: { attemptId: { in: upperIds }, isCorrect: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    lowerIds.length > 0
      ? prisma.attemptAnswer.groupBy({
          by: ['questionId'],
          where: { attemptId: { in: lowerIds }, isCorrect: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const overallById = new Map(overall.map((row) => [row.questionId, row]));
  const correctById = new Map(correct.map((row) => [row.questionId, row._count._all]));
  const upperById = new Map(upperCorrect.map((row) => [row.questionId, row._count._all]));
  const lowerById = new Map(lowerCorrect.map((row) => [row.questionId, row._count._all]));

  return testQuestions.map(({ question }) => {
    const row = overallById.get(question.id);
    const responses = row?._count._all ?? 0;
    const correctCount = correctById.get(question.id) ?? 0;

    // Correct rate is over the students who answered; difficulty index is the
    // classical p-value over everyone who sat the test, so a skipped item
    // counts against it.
    const correctRate = responses === 0 ? 0 : round(correctCount / responses, 4);
    const difficultyIndex = attemptCount === 0 ? 0 : round(correctCount / attemptCount, 4);

    const upperRate = upperIds.length === 0 ? 0 : (upperById.get(question.id) ?? 0) / upperIds.length;
    const lowerRate = lowerIds.length === 0 ? 0 : (lowerById.get(question.id) ?? 0) / lowerIds.length;

    return {
      questionId: question.id,
      text: question.text,
      type: question.type,
      attempts: responses,
      correctRate,
      difficultyIndex,
      discrimination: upperIds.length === 0 ? 0 : round(upperRate - lowerRate, 4),
      avgTimeSec: Math.round(num(row?._avg.timeSpentSeconds)),
    };
  });
};

// --- Student analytics ------------------------------------------------------

/** Consecutive days, counting back from today, on which the student submitted an attempt. */
const streakFrom = (days: Set<string>): number => {
  let streak = 0;
  const cursor = startOfDay(new Date());
  // Today not yet having activity should not reset a run that ended yesterday.
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

export const getStudentAnalytics = async (studentId: string, rangeInput: unknown) => {
  const range = parseRange(rangeInput);
  const days = RANGES[range];
  const to = new Date();
  const from = startOfDay(new Date(to.getTime() - days * 24 * 60 * 60 * 1000));

  const finishedWhere: Prisma.AttemptWhereInput = { studentId, status: { in: FINISHED } };

  const [aggregate, passed, coursesEnrolled, lessonsCompleted, seriesRows, streakRows, progress, recent] =
    await Promise.all([
      prisma.attempt.aggregate({
        where: finishedWhere,
        _count: { _all: true },
        _avg: { percentage: true },
      }),
      prisma.attempt.count({ where: { ...finishedWhere, passed: true } }),
      prisma.enrollment.count({ where: { userId: studentId, status: 'active' } }),
      prisma.lessonProgress.count({ where: { userId: studentId, completed: true } }),
      prisma.$queryRaw<SeriesRow[]>(Prisma.sql`
        SELECT DATE(submittedAt) AS day, COUNT(*) AS attempts, AVG(percentage) AS avgPercentage,
               SUM(passed = 1) AS passed
        FROM Attempt
        WHERE studentId = ${studentId}
          AND status IN ('SUBMITTED', 'EVALUATED')
          AND submittedAt >= ${from}
        GROUP BY day
        ORDER BY day ASC
      `),
      prisma.$queryRaw<{ day: Date | string }[]>(Prisma.sql`
        SELECT DISTINCT DATE(submittedAt) AS day
        FROM Attempt
        WHERE studentId = ${studentId}
          AND status IN ('SUBMITTED', 'EVALUATED')
          AND submittedAt >= DATE_SUB(NOW(), INTERVAL 400 DAY)
      `),
      prisma.courseProgress.findMany({
        where: { userId: studentId },
        select: { courseId: true, percentage: true, course: { select: { name: true } } },
      }),
      prisma.attempt.findMany({
        where: finishedWhere,
        select: {
          id: true,
          score: true,
          percentage: true,
          passed: true,
          submittedAt: true,
          test: { select: { title: true, courseId: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      }),
    ]);

  const attempts = aggregate._count._all;

  const byDay = new Map(
    seriesRows.map((row) => [
      dayKey(new Date(row.day as string)),
      { attempts: num(row.attempts), avgScore: round(num(row.avgPercentage)) },
    ]),
  );
  const series: { date: string; attempts: number; avgScore: number }[] = [];
  for (let cursor = new Date(from); cursor < to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = dayKey(cursor);
    series.push({ date: key, ...(byDay.get(key) ?? { attempts: 0, avgScore: 0 }) });
  }

  const courseScores = await prisma.attempt.groupBy({
    by: ['testId'],
    where: finishedWhere,
    _avg: { percentage: true },
  });
  const testCourse = await prisma.test.findMany({
    where: { id: { in: courseScores.map((row) => row.testId) } },
    select: { id: true, courseId: true },
  });
  const courseByTest = new Map(testCourse.map((t) => [t.id, t.courseId]));
  const scoresByCourse = new Map<string, number[]>();
  for (const row of courseScores) {
    const courseId = courseByTest.get(row.testId);
    if (!courseId) continue;
    const list = scoresByCourse.get(courseId) ?? [];
    list.push(num(row._avg.percentage));
    scoresByCourse.set(courseId, list);
  }

  return {
    kpis: {
      attempts,
      avgScore: round(num(aggregate._avg.percentage)),
      passRate: attempts === 0 ? 0 : round((passed / attempts) * 100),
      coursesEnrolled,
      lessonsCompleted,
      streakDays: streakFrom(new Set(streakRows.map((row) => dayKey(new Date(row.day as string))))),
    },
    series,
    byCourse: progress.map((row) => {
      const scores = scoresByCourse.get(row.courseId) ?? [];
      return {
        courseId: row.courseId,
        title: row.course.name,
        progress: round(row.percentage),
        avgScore: scores.length === 0 ? 0 : round(scores.reduce((a, b) => a + b, 0) / scores.length),
      };
    }),
    recentResults: recent.map((row) => ({
      attemptId: row.id,
      testTitle: row.test.title,
      score: num(row.score),
      percentage: round(num(row.percentage)),
      passed: row.passed ?? false,
      submittedAt: row.submittedAt,
    })),
  };
};
