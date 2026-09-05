import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Object-level authorization is the control most likely to be bypassed by a new
 * route, so it is tested directly against a mocked data layer rather than
 * through HTTP: the assertions here are about the decision, not the transport.
 */
const prismaMock = {
  test: { findUnique: vi.fn(), count: vi.fn() },
  question: { findUnique: vi.fn() },
  course: { findUnique: vi.fn() },
  attempt: { findUnique: vi.fn(), count: vi.fn() },
  assignment: { findUnique: vi.fn(), count: vi.fn() },
  fileUpload: { findUnique: vi.fn() },
  codingProblem: { findUnique: vi.fn() },
  classStudent: { count: vi.fn() },
  user: { findUnique: vi.fn(), count: vi.fn() },
};

vi.mock('../src/config/database.js', () => ({ prisma: prismaMock }));

const {
  assertAttemptOwnedByStudent,
  assertAttemptReadable,
  assertCourseStaffAccess,
  assertFileAccess,
  assertQuestionOwner,
  assertStudentVisible,
  assertTestOwner,
  scopedTestFilter,
} = await import('../src/services/access.service.js');

const ADMIN = { id: 'admin-1', role: 'ADMIN' };
const OWNER = { id: 'teacher-1', role: 'TEACHER' };
const OTHER_TEACHER = { id: 'teacher-2', role: 'TEACHER' };
const STUDENT = { id: 'student-1', role: 'STUDENT' };
const OTHER_STUDENT = { id: 'student-2', role: 'STUDENT' };

beforeEach(() => {
  Object.values(prismaMock).forEach((model) =>
    Object.values(model).forEach((fn) => fn.mockReset()),
  );
});

describe('test access', () => {
  const test = { id: 'test-1', createdById: OWNER.id, status: 'PUBLISHED', courseId: 'course-1' };

  it('lets the author through', async () => {
    prismaMock.test.findUnique.mockResolvedValue(test);
    await expect(assertTestOwner('test-1', OWNER)).resolves.toMatchObject({ id: 'test-1' });
  });

  it('lets an administrator through', async () => {
    prismaMock.test.findUnique.mockResolvedValue(test);
    await expect(assertTestOwner('test-1', ADMIN)).resolves.toMatchObject({ id: 'test-1' });
  });

  it('blocks a teacher who did not author the test', async () => {
    prismaMock.test.findUnique.mockResolvedValue(test);
    await expect(assertTestOwner('test-1', OTHER_TEACHER)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('reports a missing test as 404', async () => {
    prismaMock.test.findUnique.mockResolvedValue(null);
    await expect(assertTestOwner('nope', ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('scopes list queries to the author for teachers and not at all for admins', () => {
    expect(scopedTestFilter(OWNER)).toEqual({ createdById: OWNER.id });
    expect(scopedTestFilter(ADMIN)).toEqual({});
  });
});

describe('question access', () => {
  it('blocks a teacher reading another teacher question bank item', async () => {
    prismaMock.question.findUnique.mockResolvedValue({ id: 'q-1', createdById: OWNER.id });
    await expect(assertQuestionOwner('q-1', OTHER_TEACHER)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('attempt access', () => {
  const attempt = { id: 'attempt-1', studentId: STUDENT.id, test: { createdById: OWNER.id } };

  it('lets the sitting student read their own attempt', async () => {
    prismaMock.attempt.findUnique.mockResolvedValue(attempt);
    await expect(assertAttemptReadable('attempt-1', STUDENT)).resolves.toMatchObject({ id: 'attempt-1' });
  });

  it('lets the test author read the attempt', async () => {
    prismaMock.attempt.findUnique.mockResolvedValue(attempt);
    await expect(assertAttemptReadable('attempt-1', OWNER)).resolves.toMatchObject({ id: 'attempt-1' });
  });

  it('blocks another student', async () => {
    prismaMock.attempt.findUnique.mockResolvedValue(attempt);
    await expect(assertAttemptReadable('attempt-1', OTHER_STUDENT)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('blocks a teacher who does not own the test', async () => {
    prismaMock.attempt.findUnique.mockResolvedValue(attempt);
    await expect(assertAttemptReadable('attempt-1', OTHER_TEACHER)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('hides another student attempt behind 404 so ids cannot be enumerated', async () => {
    prismaMock.attempt.findUnique.mockResolvedValue({ id: 'attempt-1', studentId: STUDENT.id });
    await expect(assertAttemptOwnedByStudent('attempt-1', OTHER_STUDENT.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('file access', () => {
  it('hides another user upload behind 404', async () => {
    prismaMock.fileUpload.findUnique.mockResolvedValue({ id: 'f-1', uploadedById: STUDENT.id });
    await expect(assertFileAccess('f-1', OTHER_STUDENT)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('course staff access', () => {
  it('admits a teacher who authored a test inside the course', async () => {
    prismaMock.course.findUnique.mockResolvedValue({ id: 'course-1', organizationId: null });
    prismaMock.test.count.mockResolvedValue(1);
    prismaMock.user.count.mockResolvedValue(0);
    await expect(assertCourseStaffAccess('course-1', OWNER)).resolves.toMatchObject({ id: 'course-1' });
  });

  it('rejects a teacher with no test, organisation or assignment link', async () => {
    prismaMock.course.findUnique.mockResolvedValue({ id: 'course-1', organizationId: null });
    prismaMock.test.count.mockResolvedValue(0);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.assignment.count.mockResolvedValue(0);
    await expect(assertCourseStaffAccess('course-1', OTHER_TEACHER)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('student visibility', () => {
  it('admits a teacher whose test the student has sat', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: STUDENT.id, role: 'STUDENT' });
    prismaMock.attempt.count.mockResolvedValue(2);
    prismaMock.classStudent.count.mockResolvedValue(0);
    await expect(assertStudentVisible(STUDENT.id, OWNER)).resolves.toMatchObject({ id: STUDENT.id });
  });

  it('rejects a teacher with no teaching relationship to the student', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: STUDENT.id, role: 'STUDENT' });
    prismaMock.attempt.count.mockResolvedValue(0);
    prismaMock.classStudent.count.mockResolvedValue(0);
    await expect(assertStudentVisible(STUDENT.id, OTHER_TEACHER)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('lets a student read their own record without a relationship lookup', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: STUDENT.id, role: 'STUDENT' });
    await expect(assertStudentVisible(STUDENT.id, STUDENT)).resolves.toMatchObject({ id: STUDENT.id });
    expect(prismaMock.attempt.count).not.toHaveBeenCalled();
  });
});
