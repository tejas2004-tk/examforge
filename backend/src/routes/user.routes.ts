import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createUser,
  deleteUser,
  getMyPreferences,
  listUsers,
  patchMyPreferences,
  updateMyProfile,
  updateUser,
} from '../controllers/user.controller.js';

export const userRouter = Router();

userRouter.use(requireAuth);

// Self-service routes are declared before the administrator guard so that
// "/me/..." never falls under requireRole('ADMIN').
userRouter.get('/me/preferences', getMyPreferences);
userRouter.patch('/me/preferences', patchMyPreferences);
userRouter.patch('/me', updateMyProfile);

const adminOnly = requireRole('ADMIN', 'ORG_ADMIN');

userRouter.get('/', adminOnly, listUsers);
userRouter.post('/', adminOnly, auditLog('CREATE', 'User'), createUser);
userRouter.patch('/:id', adminOnly, auditLog('UPDATE', 'User'), updateUser);
userRouter.delete('/:id', adminOnly, auditLog('DELETE', 'User'), deleteUser);
