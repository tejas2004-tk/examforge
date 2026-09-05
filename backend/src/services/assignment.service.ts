import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function createAssignment(data: {
  title: string;
  description?: string;
  courseId?: string;
  maxMarks: number;
  dueAt?: Date;
  attachmentUrl?: string;
  createdById: string;
}) {
  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) throw new AppError(404, 'Course not found');
  }
  const creator = await prisma.user.findUnique({ where: { id: data.createdById } });
  if (!creator || (creator.role !== 'ADMIN' && creator.role !== 'TEACHER')) {
    throw new AppError(403, 'Only teachers and admins can create assignments');
  }

  return prisma.assignment.create({
    data: {
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      maxMarks: data.maxMarks,
      dueAt: data.dueAt,
      attachmentUrl: data.attachmentUrl,
      createdById: data.createdById,
    },
    include: { course: true, _count: { select: { submissions: true } } },
  });
}

export async function listAssignments(
  userId: string,
  role: string,
  query: { page: number; limit: number; courseId?: string; search?: string },
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const where: Prisma.AssignmentWhereInput = {};

  if (role === 'STUDENT') {
    where.courseId = query.courseId || undefined;
  } else if (role === 'TEACHER') {
    where.createdById = userId;
    if (query.courseId) where.courseId = query.courseId;
  } else if (query.courseId) {
    where.courseId = query.courseId;
  }

  if (query.search) {
    where.title = { contains: query.search };
  }

  const [items, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        course: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getAssignment(id: string, userId: string, role: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      course: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
      submissions: {
        include: {
          student: { select: { id: true, fullName: true, email: true, username: true } },
        },
        orderBy: { submittedAt: 'desc' },
      },
      _count: { select: { submissions: true } },
    },
  });

  if (!assignment) throw new AppError(404, 'Assignment not found');

  if (role === 'STUDENT') {
    const submission = assignment.submissions.find((s) => s.studentId === userId);
    return {
      ...assignment,
      submissions: undefined,
      mySubmission: submission ?? null,
      _count: assignment._count,
    };
  }

  return assignment;
}

export async function updateAssignment(
  id: string,
  userId: string,
  role: string,
  data: Record<string, unknown>,
) {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Assignment not found');
  if (role !== 'ADMIN' && existing.createdById !== userId) throw new AppError(403, 'Not authorized');

  return prisma.assignment.update({
    where: { id },
    data,
    include: { course: true, _count: { select: { submissions: true } } },
  });
}

export async function deleteAssignment(id: string, userId: string, role: string) {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Assignment not found');
  if (role !== 'ADMIN' && existing.createdById !== userId) throw new AppError(403, 'Not authorized');

  await prisma.assignment.delete({ where: { id } });
  return { deleted: true };
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  data: { answerText?: string; fileUrl?: string },
) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AppError(404, 'Assignment not found');

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== 'STUDENT') throw new AppError(403, 'Only students can submit');

  if (assignment.dueAt && new Date() > assignment.dueAt) {
    throw new AppError(400, 'Assignment deadline has passed');
  }

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
  });

  if (existing) {
    return prisma.assignmentSubmission.update({
      where: { id: existing.id },
      data: { answerText: data.answerText, fileUrl: data.fileUrl },
      include: { student: { select: { id: true, fullName: true, email: true } } },
    });
  }

  return prisma.assignmentSubmission.create({
    data: {
      assignmentId,
      studentId,
      answerText: data.answerText,
      fileUrl: data.fileUrl,
    },
    include: { student: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function gradeSubmission(
  submissionId: string,
  graderId: string,
  data: { marks: number; feedback?: string },
) {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission) throw new AppError(404, 'Submission not found');

  const assignment = submission.assignment;
  if (data.marks > Number(assignment.maxMarks)) {
    throw new AppError(400, `Marks cannot exceed ${assignment.maxMarks}`);
  }

  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { marks: data.marks, feedback: data.feedback },
    include: {
      student: { select: { id: true, fullName: true, email: true } },
      assignment: true,
    },
  });
}

export async function listMySubmissions(studentId: string) {
  return prisma.assignmentSubmission.findMany({
    where: { studentId },
    include: {
      assignment: {
        include: { course: true, createdBy: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });
}
