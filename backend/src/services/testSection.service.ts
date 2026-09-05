import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function createSection(testId: string, data: { title: string; description?: string; durationMinutes?: number; marks?: number }) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(404, 'Test not found');
  if (test.status !== 'DRAFT') throw new AppError(400, 'Cannot modify sections of a published test');

  const maxOrder = await prisma.testSection.aggregate({ where: { testId }, _max: { orderIndex: true } });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  return prisma.testSection.create({
    data: {
      testId,
      title: data.title,
      description: data.description,
      durationMinutes: data.durationMinutes,
      marks: data.marks ? new Prisma.Decimal(data.marks) : undefined,
      orderIndex,
    },
  });
}

export async function listSections(testId: string) {
  return prisma.testSection.findMany({
    where: { testId },
    orderBy: { orderIndex: 'asc' },
  });
}

export async function updateSection(id: string, data: { title?: string; description?: string; durationMinutes?: number; marks?: number }) {
  const section = await prisma.testSection.findUnique({ where: { id }, include: { test: true } });
  if (!section) throw new AppError(404, 'Section not found');
  if (section.test.status !== 'DRAFT') throw new AppError(400, 'Cannot modify sections of a published test');

  const updateData: Prisma.TestSectionUpdateInput = {};
  if (data.title) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.marks !== undefined) updateData.marks = new Prisma.Decimal(data.marks);

  return prisma.testSection.update({ where: { id }, data: updateData });
}

export async function deleteSection(id: string) {
  const section = await prisma.testSection.findUnique({ where: { id }, include: { test: true } });
  if (!section) throw new AppError(404, 'Section not found');
  if (section.test.status !== 'DRAFT') throw new AppError(400, 'Cannot modify sections of a published test');
  await prisma.testSection.delete({ where: { id } });
  return { deleted: true };
}

export async function reorderSections(testId: string, sectionIds: string[]) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(404, 'Test not found');
  if (test.status !== 'DRAFT') throw new AppError(400, 'Cannot reorder sections of a published test');

  for (let i = 0; i < sectionIds.length; i++) {
    await prisma.testSection.update({
      where: { id: sectionIds[i] },
      data: { orderIndex: i },
    });
  }

  return { reordered: sectionIds.length };
}
