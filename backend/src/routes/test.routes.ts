import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  assignTest,
  closeTest,
  createTest,
  deleteTest,
  getTest,
  listAssignedStudents,
  listStudents,
  listTests,
  publishTest,
  unpublishTest,
  updateTest,
} from '../controllers/test.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const testRouter = Router();

testRouter.use(requireAuth, staffOnly);

testRouter.get('/', listTests);
testRouter.get('/students/list', listStudents);
testRouter.get('/:id', getTest);
testRouter.post('/', auditLog('CREATE', 'Test'), createTest);
testRouter.put('/:id', auditLog('UPDATE', 'Test'), updateTest);
testRouter.delete('/:id', auditLog('DELETE', 'Test'), deleteTest);
testRouter.post('/:id/publish', auditLog('PUBLISH', 'Test'), publishTest);
testRouter.post('/:id/unpublish', auditLog('UNPUBLISH', 'Test'), unpublishTest);
testRouter.post('/:id/close', auditLog('CLOSE', 'Test'), closeTest);
testRouter.post('/:id/assign', auditLog('ASSIGN', 'Test'), assignTest);
testRouter.get('/:id/assigned-students', listAssignedStudents);
