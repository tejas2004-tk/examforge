import { prisma } from '../config/database.js';

export async function globalSearch(query: string, limit: number = 10) {
  const q = query.trim();
  if (!q) return { courses: [], tests: [], questions: [], assignments: [], users: [], lessons: [] };

  const [courses, tests, questions, assignments, users, lessons] = await Promise.all([
    prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, code: true, description: true, category: true },
      take: limit,
    }),
    prisma.test.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, title: true, description: true, status: true, examMode: true },
      take: limit,
    }),
    prisma.question.findMany({
      where: {
        OR: [
          { text: { contains: q } },
          { topic: { contains: q } },
          { subtopic: { contains: q } },
        ],
      },
      select: { id: true, text: true, type: true, difficulty: true, topic: true },
      take: limit,
    }),
    prisma.assignment.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, title: true, description: true, dueAt: true },
      take: limit,
    }),
    prisma.user.findMany({
      where: {
        isBlocked: false,
        OR: [
          { fullName: { contains: q } },
          { username: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, fullName: true, username: true, email: true, role: true },
      take: limit,
    }),
    prisma.lesson.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      select: { id: true, title: true, type: true },
      take: limit,
    }),
  ]);

  return {
    courses,
    tests,
    questions,
    assignments,
    users,
    lessons,
    count: courses.length + tests.length + questions.length + assignments.length + users.length + lessons.length,
  };
}