import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  CreateResourceInput,
} from '../schemas/lms.schema.js';

export async function createModule(courseId: string, data: CreateModuleInput) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');

  const maxOrder = await prisma.module.aggregate({ where: { courseId }, _max: { orderIndex: true } });
  const orderIndex = data.orderIndex ?? ((maxOrder._max.orderIndex ?? -1) + 1);

  return prisma.module.create({ data: { ...data, orderIndex, courseId }, include: { _count: { select: { lessons: true } } } });
}

export async function listModules(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');

  return prisma.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: 'asc' },
    include: { _count: { select: { lessons: true } } },
  });
}

export async function getModule(id: string) {
  const mod = await prisma.module.findUnique({
    where: { id },
    include: {
      lessons: { orderBy: { orderIndex: 'asc' }, include: { resources: true, _count: { select: { progress: true } } } },
      course: true,
    },
  });
  if (!mod) throw new AppError(404, 'Module not found');
  return mod;
}

export async function updateModule(id: string, data: UpdateModuleInput) {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) throw new AppError(404, 'Module not found');
  return prisma.module.update({ where: { id }, data });
}

export async function deleteModule(id: string) {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) throw new AppError(404, 'Module not found');
  await prisma.module.delete({ where: { id } });
  return { deleted: true };
}

export async function createLesson(moduleId: string, data: CreateLessonInput) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) throw new AppError(404, 'Module not found');

  const maxOrder = await prisma.lesson.aggregate({ where: { moduleId }, _max: { orderIndex: true } });
  const orderIndex = data.orderIndex ?? ((maxOrder._max.orderIndex ?? -1) + 1);

  const lesson = await prisma.lesson.create({ data: { ...data, orderIndex, moduleId } });

  await recalculateCourseProgress(mod.courseId);

  return lesson;
}

export async function getLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { resources: true, module: true } });
  if (!lesson) throw new AppError(404, 'Lesson not found');
  return lesson;
}

export async function updateLesson(id: string, data: UpdateLessonInput) {
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) throw new AppError(404, 'Lesson not found');
  return prisma.lesson.update({ where: { id }, data });
}

export async function deleteLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { module: true } });
  if (!lesson) throw new AppError(404, 'Lesson not found');
  await prisma.lesson.delete({ where: { id } });
  return { deleted: true };
}

export async function addResource(lessonId: string, data: CreateResourceInput) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new AppError(404, 'Lesson not found');
  return prisma.resource.create({ data: { ...data, lessonId } });
}

export async function deleteResource(id: string) {
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) throw new AppError(404, 'Resource not found');
  await prisma.resource.delete({ where: { id } });
  return { deleted: true };
}

export async function enrollStudent(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');

  const existing = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return existing;

  const enrollment = await prisma.enrollment.create({ data: { userId, courseId } });

  const totalLessons = await prisma.lesson.count({ where: { module: { courseId } } });
  await prisma.courseProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, totalLessons, completedLessons: 0, percentage: 0 },
    update: { totalLessons, lastAccessedAt: new Date() },
  });

  return enrollment;
}

export async function getEnrollments(courseId: string) {
  return prisma.enrollment.findMany({
    where: { courseId },
    include: { user: { select: { id: true, fullName: true, email: true, username: true } } },
    orderBy: { enrolledAt: 'desc' },
  });
}

export async function getMyEnrollments(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: { include: { _count: { select: { modules: true, tests: true, assignments: true } } } },
    },
    orderBy: { enrolledAt: 'desc' },
  });
}

export async function markLessonComplete(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) throw new AppError(404, 'Lesson not found');

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });

  await recalculateCourseProgress(lesson.module.courseId, userId);

  // Track recently viewed
  await prisma.recentlyViewed.create({
    data: { userId, lessonId, courseId: lesson.module.courseId },
  });

  return progress;
}

export async function getCourseProgress(userId: string, courseId: string) {
  const progress = await prisma.courseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return progress;
}

export async function getLessonProgress(userId: string, courseId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    include: { progress: { where: { userId } } },
    orderBy: { orderIndex: 'asc' },
  });
  return lessons.map((l) => ({
    lessonId: l.id,
    title: l.title,
    type: l.type,
    completed: l.progress[0]?.completed ?? false,
    completedAt: l.progress[0]?.completedAt ?? null,
  }));
}

// --- Phase 8: Announcements, Ratings, Recently Viewed ---

export async function createAnnouncement(courseId: string, authorId: string, data: { title: string; message: string; pinned?: boolean }) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');
  return prisma.courseAnnouncement.create({ data: { ...data, courseId, authorId } });
}

export async function listAnnouncements(courseId: string) {
  return prisma.courseAnnouncement.findMany({
    where: { courseId },
    include: { author: { select: { id: true, fullName: true, username: true } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function deleteAnnouncement(id: string) {
  const announcement = await prisma.courseAnnouncement.findUnique({ where: { id } });
  if (!announcement) throw new AppError(404, 'Announcement not found');
  await prisma.courseAnnouncement.delete({ where: { id } });
  return { deleted: true };
}

export async function rateCourse(userId: string, courseId: string, data: { rating: number; review?: string }) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');

  const existing = await prisma.courseRating.findUnique({ where: { courseId_userId: { courseId, userId } } });
  if (existing) {
    return prisma.courseRating.update({
      where: { id: existing.id },
      data: { rating: data.rating, review: data.review },
    });
  }
  return prisma.courseRating.create({ data: { ...data, courseId, userId } });
}

export async function listRatings(courseId: string) {
  const ratings = await prisma.courseRating.findMany({
    where: { courseId },
    include: { user: { select: { id: true, fullName: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const avg = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0;
  return { ratings, average: Math.round(avg * 10) / 10, count: ratings.length };
}

export async function getRatingSummary(courseId: string) {
  const [count, agg] = await Promise.all([
    prisma.courseRating.count({ where: { courseId } }),
    prisma.courseRating.aggregate({ where: { courseId }, _avg: { rating: true } }),
  ]);
  return { count, average: agg._avg.rating ?? 0 };
}

export async function trackRecentlyViewed(userId: string, lessonId?: string, courseId?: string) {
  if (!lessonId && !courseId) return null;
  return prisma.recentlyViewed.create({
    data: { userId, lessonId, courseId },
  });
}

export async function getRecentlyViewed(userId: string, limit: number = 10) {
  return prisma.recentlyViewed.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, name: true, code: true } },
      lesson: { select: { id: true, title: true } },
    },
    orderBy: { viewedAt: 'desc' },
    take: limit,
  });
}

export async function createDiscussion(courseId: string, authorId: string, content: string, parentId?: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Course not found');
  return prisma.courseDiscussion.create({ data: { courseId, authorId, content, parentId } });
}

export async function listDiscussions(courseId: string) {
  return prisma.courseDiscussion.findMany({
    where: { courseId, parentId: null },
    include: {
      author: { select: { id: true, fullName: true, username: true } },
      replies: {
        include: { author: { select: { id: true, fullName: true, username: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteDiscussion(id: string) {
  const existing = await prisma.courseDiscussion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Discussion not found');
  await prisma.courseDiscussion.deleteMany({ where: { OR: [{ id }, { parentId: id }] } });
  return { deleted: true };
}

async function recalculateCourseProgress(courseId: string, userId?: string) {
  const where: any = userId ? { userId, courseId } : { courseId };
  const totalLessons = await prisma.lesson.count({ where: { module: { courseId } } });

  if (userId) {
    const completedLessons = await prisma.lessonProgress.count({
      where: { completed: true, lesson: { module: { courseId } }, userId },
    });
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0;
    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, totalLessons, completedLessons, percentage },
      update: { totalLessons, completedLessons, percentage, lastAccessedAt: new Date() },
    });
  } else {
    const allProgress = await prisma.courseProgress.findMany({ where: { courseId } });
    for (const p of allProgress) {
      const completed = await prisma.lessonProgress.count({
        where: { completed: true, lesson: { module: { courseId } }, userId: p.userId },
      });
      const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 10000) / 100 : 0;
      await prisma.courseProgress.update({ where: { id: p.id }, data: { totalLessons, completedLessons: completed, percentage: pct } });
    }
  }
}