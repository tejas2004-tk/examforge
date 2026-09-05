import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { gradeAnswerSchema, saveAnswerSchema, suspiciousEventSchema } from '../schemas/attempt.schema.js';
import * as attemptService from '../services/attempt.service.js';
import * as resultService from '../services/result.service.js';

export const startAttempt = asyncHandler(async (req: Request, res: Response) => {
  const data = await attemptService.startAttempt(req.user!.id, req.params.testId);
  res.status(201).json({ success: true, data });
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  const data = await attemptService.getAttempt(req.params.id, req.user!.id);
  res.json({ success: true, data });
});

export const saveAnswer = asyncHandler(async (req: Request, res: Response) => {
  const input = saveAnswerSchema.parse(req.body);
  const answer = await attemptService.saveAnswer(req.params.id, req.user!.id, input);
  res.json({ success: true, data: { answer } });
});

export const logSuspiciousEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = suspiciousEventSchema.parse(req.body);
  const data = await attemptService.logSuspiciousEvent(req.params.id, req.user!.id, input);
  res.json({ success: true, data });
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const data = await attemptService.submitAttempt(req.params.id, req.user!.id);
  res.json({ success: true, data });
});

export const gradeAnswer = asyncHandler(async (req: Request, res: Response) => {
  const input = gradeAnswerSchema.parse(req.body);
  const data = await resultService.gradeAnswer(input.answerId, req.user!.id, input.marks);
  res.json({ success: true, data });
});

export const listAssignedTests = asyncHandler(async (req: Request, res: Response) => {
  const data = await attemptService.listAssignedTestsForStudent(req.user!.id);
  res.json({ success: true, data });
});
