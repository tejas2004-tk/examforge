import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as certificateService from '../services/certificate.service.js';
import * as leaderboardService from '../services/leaderboard.service.js';

export const certificateRouter = Router();
certificateRouter.use(requireAuth);

certificateRouter.post('/', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    userId: z.string().min(1),
    courseId: z.string().optional(),
    attemptId: z.string().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    expiresAt: z.string().datetime().optional(),
  });
  const input = schema.parse(req.body);
  const cert = await certificateService.issueCertificate(input.userId, input);
  res.status(201).json({ success: true, data: { certificate: cert } });
}));

certificateRouter.get('/mine', asyncHandler(async (req, res) => {
  const certs = await certificateService.getMyCertificates(req.user!.id);
  res.json({ success: true, data: { certificates: certs } });
}));

certificateRouter.get('/verify/:credentialId', asyncHandler(async (req, res) => {
  const result = await certificateService.verifyCertificate(req.params.credentialId);
  res.json({ success: true, data: result });
}));

certificateRouter.get('/', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const certs = await certificateService.listAllCertificates();
  res.json({ success: true, data: { certificates: certs } });
}));

certificateRouter.post('/:id/revoke', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const cert = await certificateService.revokeCertificate(req.params.id);
  res.json({ success: true, data: { certificate: cert } });
}));

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

leaderboardRouter.get('/', asyncHandler(async (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const board = await leaderboardService.getLeaderboard(courseId, limit);
  res.json({ success: true, data: { leaderboard: board } });
}));

leaderboardRouter.get('/me', asyncHandler(async (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const rank = await leaderboardService.getMyRank(req.user!.id, courseId);
  res.json({ success: true, data: { rank } });
}));

leaderboardRouter.post('/recalculate', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const courseId = req.body.courseId as string | undefined;
  const result = await leaderboardService.recalculateLeaderboard(courseId);
  res.json({ success: true, data: result });
}));
