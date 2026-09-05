import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertStudentVisible } from '../services/access.service.js';
import {
  getOverview,
  getStudentAnalytics,
  getTestAnalytics,
} from '../services/analytics.service.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/overview',
  requireRole('ADMIN', 'ORG_ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const data = await getOverview(currentUser(req), req.query.range);
    res.json({ success: true, data });
  }),
);

analyticsRouter.get(
  '/tests/:testId',
  requireRole('ADMIN', 'ORG_ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const data = await getTestAnalytics(req.params.testId, currentUser(req));
    res.json({ success: true, data });
  }),
);

analyticsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    // Staff accounts reach this too, so a teacher trying the student view sees
    // their own (empty) figures rather than a 403 they cannot act on.
    const data = await getStudentAnalytics(currentUser(req).id, req.query.range);
    res.json({ success: true, data });
  }),
);

analyticsRouter.get(
  '/students/:studentId',
  requireRole('ADMIN', 'ORG_ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    await assertStudentVisible(req.params.studentId, currentUser(req));
    const data = await getStudentAnalytics(req.params.studentId, req.query.range);
    res.json({ success: true, data });
  }),
);
