import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateTestSchema } from '../schemas/test.schema.js';
import * as bankService from '../services/questionBank.service.js';

export const createBank = asyncHandler(async (req: Request, res: Response) => {
  const input = { name: String(req.body.name ?? ''), courseId: req.body.courseId };
  const bank = await bankService.createBank(req.user!.id, input);
  res.status(201).json({ success: true, data: { bank } });
});

export const listBanks = asyncHandler(async (req: Request, res: Response) => {
  const data = await bankService.listBanks(req.query, req.user!.id);
  res.json({ success: true, data });
});

export const getBank = asyncHandler(async (req: Request, res: Response) => {
  const bank = await bankService.getBank(req.params.id, req.user!.id);
  res.json({ success: true, data: { bank } });
});

export const addQuestion = asyncHandler(async (req: Request, res: Response) => {
  const membership = await bankService.addQuestionToBank(req.params.id, req.user!.id, req.body.questionId);
  res.status(201).json({ success: true, data: { membership } });
});

export const removeQuestion = asyncHandler(async (req: Request, res: Response) => {
  await bankService.removeQuestionFromBank(req.params.id, req.user!.id, req.params.questionId);
  res.json({ success: true, data: null });
});

export const deleteBank = asyncHandler(async (req: Request, res: Response) => {
  await bankService.deleteBank(req.params.id, req.user!.id);
  res.json({ success: true, data: null });
});

export const generateTest = asyncHandler(async (req: Request, res: Response) => {
  const input = generateTestSchema.parse(req.body);
  const test = await bankService.generateTestFromBank(req.user!.id, req.params.id, input);
  res.status(201).json({ success: true, data: { test } });
});
