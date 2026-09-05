import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller.js';

const adminOnly = requireRole('ADMIN');

export const userRouter = Router();

userRouter.use(requireAuth, adminOnly);

userRouter.get('/', listUsers);
userRouter.post('/', auditLog('CREATE', 'User'), createUser);
userRouter.patch('/:id', auditLog('UPDATE', 'User'), updateUser);
userRouter.delete('/:id', auditLog('DELETE', 'User'), deleteUser);
