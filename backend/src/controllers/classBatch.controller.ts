import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createClassBatchSchema,
  updateClassBatchSchema,
  addStudentsSchema,
} from '../schemas/classBatch.schema.js';
import * as classBatchService from '../services/classBatch.service.js';

export const createClassBatch = asyncHandler(async (req: Request, res: Response) => {
  const input = createClassBatchSchema.parse(req.body);
  const batch = await classBatchService.createClassBatch(input);
  res.status(201).json({ success: true, data: { batch } });
});

export const listClassBatches = asyncHandler(async (req: Request, res: Response) => {
  const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
  const batches = await classBatchService.listClassBatches(courseId);
  res.json({ success: true, data: { batches } });
});

export const getClassBatch = asyncHandler(async (req: Request, res: Response) => {
  const batch = await classBatchService.getClassBatch(req.params.id);
  res.json({ success: true, data: { batch } });
});

export const updateClassBatch = asyncHandler(async (req: Request, res: Response) => {
  const input = updateClassBatchSchema.parse(req.body);
  const batch = await classBatchService.updateClassBatch(req.params.id, input);
  res.json({ success: true, data: { batch } });
});

export const deleteClassBatch = asyncHandler(async (req: Request, res: Response) => {
  await classBatchService.deleteClassBatch(req.params.id);
  res.json({ success: true, data: null });
});

export const addStudentsToBatch = asyncHandler(async (req: Request, res: Response) => {
  const input = addStudentsSchema.parse(req.body);
  const result = await classBatchService.addStudentsToBatch(req.params.id, input.studentIds);
  res.json({ success: true, data: result });
});

export const removeStudentFromClass = asyncHandler(async (req: Request, res: Response) => {
  const result = await classBatchService.removeStudentFromClass(req.params.id, req.params.studentId);
  res.json({ success: true, data: result });
});
