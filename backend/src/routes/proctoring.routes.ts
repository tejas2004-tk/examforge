import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import {
  createSession,
  listSessions,
  listActiveSessions,
  getSession,
  endSession,
  logEvent,
  captureSnapshot,
  alertStudent,
  recomputeSuspicion,
} from '../controllers/proctoring.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER', 'PROCTOR');

export const proctoringRouter = Router();

proctoringRouter.use(requireAuth);

proctoringRouter.post('/sessions', staffOnly, createSession);
proctoringRouter.get('/sessions', staffOnly, listSessions);
proctoringRouter.get('/sessions/active', requireRole('ADMIN', 'TEACHER', 'PROCTOR'), listActiveSessions);
proctoringRouter.get('/sessions/:sessionId', staffOnly, getSession);
proctoringRouter.post('/sessions/:sessionId/end', staffOnly, endSession);
proctoringRouter.post('/sessions/:sessionId/events', staffOnly, logEvent);
proctoringRouter.post('/sessions/:sessionId/snapshots', staffOnly, captureSnapshot);
proctoringRouter.post('/sessions/:sessionId/alert', requireRole('ADMIN', 'TEACHER', 'PROCTOR'), alertStudent);
proctoringRouter.post('/sessions/recompute-suspicion', requireRole('ADMIN'), recomputeSuspicion);