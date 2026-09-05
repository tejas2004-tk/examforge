import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function createClassBatch(data: { name: string; courseId: string }) {
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) throw new AppError(404, 'Course not found');
  return prisma.classBatch.create({ data, include: { course: true, _count: { select: { students: true } } } });
}

export async function listClassBatches(courseId?: string) {
  const where: Prisma.ClassBatchWhereInput = courseId ? { courseId } : {};
  return prisma.classBatch.findMany({
    where,
    include: { course: true, _count: { select: { students: true, testAssignments: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClassBatch(id: string) {
  const batch = await prisma.classBatch.findUnique({
    where: { id },
    include: {
      course: true,
      students: { include: { student: { select: { id: true, fullName: true, email: true, username: true } } } },
      _count: { select: { students: true, testAssignments: true } },
    },
  });
  if (!batch) throw new AppError(404, 'Class batch not found');
  return batch;
}

export async function updateClassBatch(id: string, data: { name?: string }) {
  const batch = await prisma.classBatch.findUnique({ where: { id } });
  if (!batch) throw new AppError(404, 'Class batch not found');
  return prisma.classBatch.update({ where: { id }, data });
}

export async function deleteClassBatch(id: string) {
  const batch = await prisma.classBatch.findUnique({ where: { id } });
  if (!batch) throw new AppError(404, 'Class batch not found');
  await prisma.classBatch.delete({ where: { id } });
  return { deleted: true };
}

export async function addStudentsToBatch(classId: string, studentIds: string[]) {
  const batch = await prisma.classBatch.findUnique({ where: { id: classId } });
  if (!batch) throw new AppError(404, 'Class batch not found');

  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: 'STUDENT' },
    select: { id: true },
  });
  if (students.length !== new Set(studentIds).size) {
    throw new AppError(400, 'One or more student ids are invalid');
  }

  await prisma.classStudent.createMany({
    data: studentIds.map((studentId) => ({ classId, studentId })),
    skipDuplicates: true,
  });

  return { added: studentIds.length };
}

export async function removeStudentFromClass(classId: string, studentId: string) {
  const record = await prisma.classStudent.findUnique({
    where: { classId_studentId: { classId, studentId } },
  });
  if (!record) throw new AppError(404, 'Student not in this class');
  await prisma.classStudent.delete({ where: { id: record.id } });
  return { removed: true };
}
