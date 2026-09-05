import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as auditService from '../services/audit.service.js';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const result = await auditService.listAuditLogs({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    entity: req.query.entity as string,
    userId: req.query.userId as string,
    action: req.query.action as string,
  });
  res.json({ success: true, data: result });
}));
