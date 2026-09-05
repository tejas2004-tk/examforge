import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import {
  getResultDetail,
  listResults,
  listSubmissions,
} from '../controllers/result.controller.js';

export const resultRouter = Router();

resultRouter.use(requireAuth);

resultRouter.get('/my', requireRole('STUDENT'), listResults);
resultRouter.get('/', requireRole('ADMIN', 'TEACHER'), listSubmissions);
resultRouter.get('/:id', getResultDetail);
