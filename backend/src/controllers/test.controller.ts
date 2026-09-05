import { Request, Response } from 'express';
import { TestStatus } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignTestSchema,
  createTestSchema,
  listTestsQuerySchema,
  updateTestSchema,
} from '../schemas/test.schema.js';
import * as testService from '../services/test.service.js';

export const createTest = asyncHandler(async (req: Request, res: Response) => {
  const input = createTestSchema.parse(req.body);
  const test = await testService.createTest(req.user!.id, input);
  res.status(201).json({ success: true, data: { test } });
});

export const listTests = asyncHandler(async (req: Request, res: Response) => {
  listTestsQuerySchema.parse(req.query);
  const data = await testService.listTests(req.user!, req.query);
  res.json({ success: true, data });
});

export const getTest = asyncHandler(async (req: Request, res: Response) => {
  const test = await testService.getTest(req.params.id);
  res.json({ success: true, data: { test } });
});

export const updateTest = asyncHandler(async (req: Request, res: Response) => {
  const input = updateTestSchema.parse(req.body);
  const test = await testService.updateTest(req.params.id, req.user!, input);
  res.json({ success: true, data: { test } });
});

export const publishTest = asyncHandler(async (req: Request, res: Response) => {
  const test = await testService.setTestStatus(req.params.id, req.user!, TestStatus.PUBLISHED);
  res.json({ success: true, data: { test } });
});

export const unpublishTest = asyncHandler(async (req: Request, res: Response) => {
  const test = await testService.setTestStatus(req.params.id, req.user!, TestStatus.DRAFT);
  res.json({ success: true, data: { test } });
});

export const closeTest = asyncHandler(async (req: Request, res: Response) => {
  const test = await testService.setTestStatus(req.params.id, req.user!, TestStatus.CLOSED);
  res.json({ success: true, data: { test } });
});

export const assignTest = asyncHandler(async (req: Request, res: Response) => {
  const input = assignTestSchema.parse(req.body);
  const result = await testService.assignTest(req.params.id, req.user!, input);
  res.json({ success: true, data: result });
});

export const listAssignedStudents = asyncHandler(async (req: Request, res: Response) => {
  const students = await testService.listAssignedStudents(req.params.id);
  res.json({ success: true, data: { students } });
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const students = await testService.listStudentsForAssignment(typeof req.query.search === 'string' ? req.query.search : undefined);
  res.json({ success: true, data: { students } });
});

export const deleteTest = asyncHandler(async (req: Request, res: Response) => {
  await testService.deleteTest(req.params.id, req.user!);
  res.json({ success: true, data: null });
});
