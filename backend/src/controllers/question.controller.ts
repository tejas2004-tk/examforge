import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  updateQuestionSchema,
} from '../schemas/question.schema.js';
import * as questionService from '../services/question.service.js';

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const input = createQuestionSchema.parse(req.body);
  const question = await questionService.createQuestion(req.user!.id, input);
  res.status(201).json({ success: true, data: { question } });
});

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  listQuestionsQuerySchema.parse(req.query);
  const data = await questionService.listQuestions(req.query, req.user!.role === 'ADMIN' ? undefined : req.user!.id);
  res.json({ success: true, data });
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await questionService.getQuestion(req.params.id);
  res.json({ success: true, data: { question } });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const input = updateQuestionSchema.parse(req.body);
  const question = await questionService.updateQuestion(req.params.id, input);
  res.json({ success: true, data: { question } });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  await questionService.deleteQuestion(req.params.id);
  res.json({ success: true, data: null });
});
