import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as aiService from '../services/ai.service.js';
import { requireRole } from '../middleware/authorize.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post('/conversations', asyncHandler(async (req, res) => {
  const schema = z.object({
    title: z.string().max(200).optional(),
    topic: z.string().max(200).optional(),
    courseId: z.string().optional(),
  });
  const input = schema.parse(req.body);
  const conversation = await aiService.createConversation(req.user!.id, input);
  res.status(201).json({ success: true, data: { conversation } });
}));

aiRouter.get('/conversations', asyncHandler(async (req, res) => {
  const conversations = await aiService.listConversations(req.user!.id);
  res.json({ success: true, data: { conversations } });
}));

aiRouter.get('/conversations/:id', asyncHandler(async (req, res) => {
  const conversation = await aiService.getConversation(req.params.id, req.user!.id);
  res.json({ success: true, data: { conversation } });
}));

aiRouter.post('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const schema = z.object({ content: z.string().min(1).max(10000) });
  const { content } = schema.parse(req.body);
  const message = await aiService.sendTutorMessage(req.user!.id, req.params.id, content);
  res.status(201).json({ success: true, data: { message } });
}));

aiRouter.delete('/conversations/:id', asyncHandler(async (req, res) => {
  await aiService.deleteConversation(req.params.id, req.user!.id);
  res.json({ success: true, data: null });
}));

aiRouter.post('/generate-questions', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    subject: z.string().min(1),
    topic: z.string().min(1),
    difficulty: z.string(),
    count: z.coerce.number().int().min(1).max(20),
    type: z.string().optional(),
  });
  const input = schema.parse(req.body);
  const result = await aiService.generateQuestions({ ...input, createdById: req.user!.id });
  res.json({ success: true, data: result });
}));

aiRouter.post('/analyze-result', asyncHandler(async (req, res) => {
  const schema = z.object({ attemptId: z.string().min(1) });
  const { attemptId } = schema.parse(req.body);
  const result = await aiService.analyzeResult(attemptId, req.user!);
  res.json({ success: true, data: result });
}));

aiRouter.get('/recommendations/:studentId', asyncHandler(async (req, res) => {
  const result = await aiService.getRecommendations(req.params.studentId, req.user!);
  res.json({ success: true, data: result });
}));