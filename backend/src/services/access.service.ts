import { prisma } from '../config/database.js';
import { isAdmin } from '../middleware/authorize.js';
import { AppError, forbidden, notFound } from '../utils/errors.js';

export interface Viewer {
  id: string;
  role: string;
}

/**
 * Object-level authorization lives here rather than in each service so that
 * every caller reaches the same decision for the same object, and so a new
 * route cannot silently skip the check by forgetting to pass a viewer through.
 *
 * The rule everywhere is: administrators see everything; a teacher reaches only
 * the objects they created (or that hang off a test/course they created); a
 * student reaches only their own attempts, submissions and results.
 */

export const assertTestOwner = async (testId: string, viewer: Viewer) => {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, createdById: true, status: true, courseId: true },
  });
  if (!test) throw notFound('Test');
  if (!isAdmin(viewer.role) && test.createdById !== viewer.id) {
    throw forbidden('You do not have access to this test');
  }
  return test;
};

export const assertQuestionOwner = async (questionId: string, viewer: Viewer) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, createdById: true },
  });
  if (!question) throw notFound('Question');
  if (!isAdmin(viewer.role) && question.createdById !== viewer.id) {
    throw forbidden('You do not have access to this question');
  }
  return question;
};

export const assertCourseStaffAccess = async (courseId: string, viewer: Viewer) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, organizationId: true },
  });
  if (!course) throw notFound('Course');
  if (isAdmin(viewer.role)) return course;

  // Course rows carry no single owner, so a teacher qualifies by having authored
  // something inside the course or by sharing the course's organisation.
  const [authored, sameOrg] = await Promise.all([
    prisma.test.count({ where: { courseId, createdById: viewer.id } }),
    course.organizationId
      ? prisma.user.count({ where: { id: viewer.id, organizationId: course.organizationId } })
      : Promise.resolve(0),
  ]);
  if (authored === 0 && sameOrg === 0) {
    const assignments = await prisma.assignment.count({
      where: { courseId, createdById: viewer.id },
    });
    if (assignments === 0) throw forbidden('You do not have access to this course');
  }
  return course;
};

export const assertAttemptReadable = async (attemptId: string, viewer: Viewer) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, studentId: true, test: { select: { createdById: true } } },
  });
  if (!attempt) throw notFound('Attempt');
  if (isAdmin(viewer.role)) return attempt;
  if (viewer.role === 'STUDENT' && attempt.studentId === viewer.id) return attempt;
  if (viewer.role === 'TEACHER' && attempt.test.createdById === viewer.id) return attempt;
  throw forbidden('You do not have access to this attempt');
};

export const assertAttemptOwnedByStudent = async (attemptId: string, studentId: string) => {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound('Attempt');
  if (attempt.studentId !== studentId) {
    // A 404 rather than a 403 keeps attempt ids from being enumerable.
    throw new AppError(404, 'Attempt not found', undefined, 'NOT_FOUND');
  }
  return attempt;
};

export const assertAssignmentOwner = async (assignmentId: string, viewer: Viewer) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, createdById: true, courseId: true, maxMarks: true },
  });
  if (!assignment) throw notFound('Assignment');
  if (!isAdmin(viewer.role) && assignment.createdById !== viewer.id) {
    throw forbidden('You do not have access to this assignment');
  }
  return assignment;
};

export const assertFileAccess = async (fileId: string, viewer: Viewer) => {
  const file = await prisma.fileUpload.findUnique({ where: { id: fileId } });
  if (!file) throw notFound('File');
  if (!isAdmin(viewer.role) && file.uploadedById !== viewer.id) {
    throw new AppError(404, 'File not found', undefined, 'NOT_FOUND');
  }
  return file;
};

export const assertCodingProblemOwner = async (problemId: string, viewer: Viewer) => {
  const problem = await prisma.codingProblem.findUnique({
    where: { id: problemId },
    select: { id: true, createdById: true },
  });
  if (!problem) throw notFound('Coding problem');
  if (!isAdmin(viewer.role) && problem.createdById !== viewer.id) {
    throw forbidden('You do not have access to this coding problem');
  }
  return problem;
};

/**
 * A teacher may look at a student's record only once that student has entered
 * their orbit: sat one of their tests, joined a class on one of their courses,
 * or enrolled on a course they teach.
 */
export const assertStudentVisible = async (studentId: string, viewer: Viewer) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true },
  });
  if (!student) throw notFound('Student');
  if (isAdmin(viewer.role)) return student;
  if (viewer.id === studentId) return student;

  const [attempts, classes] = await Promise.all([
    prisma.attempt.count({ where: { studentId, test: { createdById: viewer.id } } }),
    prisma.classStudent.count({
      where: { studentId, class: { course: { tests: { some: { createdById: viewer.id } } } } },
    }),
  ]);
  if (attempts === 0 && classes === 0) throw forbidden('You do not teach this student');
  return student;
};

/** Test ids a teacher may see; undefined means "no restriction" (administrators). */
export const scopedTestFilter = (viewer: Viewer): { createdById?: string } =>
  isAdmin(viewer.role) ? {} : { createdById: viewer.id };
