import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import type { CreateCourseInput, UpdateCourseInput } from '../schemas/course.schema.js';

export const createCourse = async (input: CreateCourseInput) => {
  const code = input.code.toUpperCase();
  const existing = await prisma.course.findUnique({ where: { code } });
  if (existing) throw new AppError(409, `Course code ${code} already exists`);

  return prisma.course.create({ data: { name: input.name, code, description: input.description } });
};

export const listCourses = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;

  const where: Prisma.CourseWhereInput = search
    ? {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { _count: { select: { classBatches: true, tests: true } } },
    }),
    prisma.course.count({ where }),
  ]);

  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getCourse = async (id: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { classBatches: { include: { _count: { select: { students: true } } } } },
  });
  if (!course) throw new AppError(404, 'Course not found');
  return course;
};

export const updateCourse = async (id: string, input: UpdateCourseInput) => {
  await getCourse(id);
  const data: Prisma.CourseUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.code) data.code = input.code.toUpperCase();

  try {
    return await prisma.course.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Course code already exists');
    }
    throw error;
  }
};

export const deleteCourse = async (id: string) => {
  await getCourse(id);
  await prisma.course.delete({ where: { id } });
};
