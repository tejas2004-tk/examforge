import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function createOrganization(input: {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  brandColor?: string;
  settings?: unknown;
}) {
  const existing = await prisma.organization.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, 'Organization with this slug already exists');

  return prisma.organization.create({ data: { ...input, settings: input.settings as any } });
}

export async function listOrganizations() {
  return prisma.organization.findMany({
    include: { _count: { select: { members: true, departments: true, courses: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrganization(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      departments: { include: { _count: { select: { batches: true } } } },
      _count: { select: { courses: true, users: true } },
    },
  });
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

export async function updateOrganization(id: string, input: any) {
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Organization not found');
  return prisma.organization.update({ where: { id }, data: input });
}

export async function addOrganizationMember(orgId: string, userId: string, role?: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'Organization not found');

  const existing = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (existing) throw new AppError(409, 'User is already a member');

  const member = await prisma.orgMember.create({
    data: { organizationId: orgId, userId, role: role ?? 'MEMBER' },
  });

  // Associate user with org
  await prisma.user.update({ where: { id: userId }, data: { organizationId: orgId } });

  return member;
}

export async function removeOrganizationMember(orgId: string, userId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!member) throw new AppError(404, 'Member not found');

  await prisma.orgMember.delete({ where: { id: member.id } });

  // If user has no other org memberships, clear org id
  const remaining = await prisma.orgMember.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.user.update({ where: { id: userId }, data: { organizationId: null } });
  }

  return { removed: true };
}

// Departments
export async function createDepartment(orgId: string, input: { name: string; code?: string; description?: string }) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'Organization not found');
  return prisma.department.create({ data: { ...input, organizationId: orgId } });
}

export async function listDepartments(orgId: string) {
  return prisma.department.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { batches: true, academicYears: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function updateDepartment(id: string, input: any) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new AppError(404, 'Department not found');
  return prisma.department.update({ where: { id }, data: input });
}

export async function deleteDepartment(id: string) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new AppError(404, 'Department not found');
  await prisma.department.delete({ where: { id } });
  return { deleted: true };
}

// Academic Years
export async function createAcademicYear(orgId: string, input: { name: string; startDate: string; endDate?: string; departmentId?: string }) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'Organization not found');
  return prisma.academicYear.create({
    data: {
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      departmentId: input.departmentId,
      organizationId: orgId,
    },
  });
}

export async function listAcademicYears(orgId: string) {
  return prisma.academicYear.findMany({
    where: { organizationId: orgId },
    include: { semesters: true },
    orderBy: { startDate: 'desc' },
  });
}

// Semesters
export async function createSemester(academicYearId: string, input: { name: string; orderIndex?: number }) {
  const ay = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  if (!ay) throw new AppError(404, 'Academic year not found');
  return prisma.semester.create({ data: { ...input, academicYearId } });
}

export async function listSemesters(academicYearId: string) {
  return prisma.semester.findMany({
    where: { academicYearId },
    include: { _count: { select: { batches: true } } },
    orderBy: { orderIndex: 'asc' },
  });
}

// Batches
export async function createBatch(departmentId: string, input: { name: string; code?: string; startYear?: number; endYear?: number; semesterId?: string }) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw new AppError(404, 'Department not found');
  return prisma.batch.create({ data: { ...input, departmentId } });
}

export async function listBatches(departmentId: string) {
  return prisma.batch.findMany({
    where: { departmentId },
    include: { _count: { select: { students: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function addStudentToBatch(batchId: string, studentId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AppError(404, 'Batch not found');

  const user = await prisma.user.findUnique({ where: { id: studentId } });
  if (!user) throw new AppError(404, 'Student not found');
  if (user.role !== 'STUDENT') throw new AppError(400, 'User is not a student');

  return prisma.batchStudent.upsert({
    where: { batchId_studentId: { batchId, studentId } },
    create: { batchId, studentId },
    update: {},
  });
}

export async function removeStudentFromBatch(batchId: string, studentId: string) {
  const membership = await prisma.batchStudent.findUnique({
    where: { batchId_studentId: { batchId, studentId } },
  });
  if (!membership) throw new AppError(404, 'Student not in batch');
  await prisma.batchStudent.delete({ where: { id: membership.id } });
  return { removed: true };
}

export async function listBatchStudents(batchId: string) {
  return prisma.batchStudent.findMany({
    where: { batchId },
    include: { student: { select: { id: true, fullName: true, email: true, username: true } } },
    orderBy: { student: { fullName: 'asc' } },
  });
}