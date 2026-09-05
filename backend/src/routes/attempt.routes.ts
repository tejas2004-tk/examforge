import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import {
  getAttempt,
  gradeAnswer,
  logSuspiciousEvent,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from '../controllers/attempt.controller.js';

const studentOnly = requireRole('STUDENT');

export const attemptRouter = Router();

// Teacher/admin grading endpoint.
attemptRouter.post('/attempts/:id/grade', requireAuth, requireRole('ADMIN', 'TEACHER'), gradeAnswer);

// Student attempt endpoints.
attemptRouter.post('/tests/:testId/start', requireAuth, studentOnly, startAttempt);
attemptRouter.get('/attempts/:id', requireAuth, studentOnly, getAttempt);
attemptRouter.put('/attempts/:id/answers', requireAuth, studentOnly, saveAnswer);
attemptRouter.post('/attempts/:id/events', requireAuth, studentOnly, logSuspiciousEvent);
attemptRouter.post('/attempts/:id/submit', requireAuth, studentOnly, submitAttempt);
