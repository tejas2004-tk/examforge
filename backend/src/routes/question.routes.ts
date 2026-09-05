import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
} from '../controllers/question.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as analyticsService from '../services/questionAnalytics.service.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const questionRouter = Router();

questionRouter.use(requireAuth, staffOnly);

questionRouter.get('/', listQuestions);
questionRouter.get('/:id', getQuestion);
questionRouter.post('/', createQuestion);
questionRouter.put('/:id', updateQuestion);
questionRouter.delete('/:id', deleteQuestion);

questionRouter.get('/analytics/dashboard', asyncHandler(async (req, res) => {
  const data = await analyticsService.getQuestionAnalyticsDashboard();
  res.json({ success: true, data });
}));

questionRouter.get('/:id/analytics', asyncHandler(async (req, res) => {
  const data = await analyticsService.getQuestionAnalytics(req.params.id);
  res.json({ success: true, data });
}));

questionRouter.post('/analytics/recalculate', asyncHandler(async (req, res) => {
  const data = await analyticsService.recalculateAllQuestionAnalytics();
  res.json({ success: true, data });
}));

questionRouter.get('/:id/versions', asyncHandler(async (req, res) => {
  const versions = await analyticsService.getQuestionVersions(req.params.id);
  res.json({ success: true, data: { versions } });
}));

questionRouter.post('/:id/versions', asyncHandler(async (req, res) => {
  const version = await analyticsService.createQuestionVersion(req.params.id);
  res.json({ success: true, data: { version } });
}));
