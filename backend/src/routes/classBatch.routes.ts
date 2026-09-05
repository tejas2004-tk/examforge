import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createClassBatch,
  listClassBatches,
  getClassBatch,
  updateClassBatch,
  deleteClassBatch,
  addStudentsToBatch,
  removeStudentFromClass,
} from '../controllers/classBatch.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const classBatchRouter = Router();

classBatchRouter.use(requireAuth, staffOnly);

classBatchRouter.get('/', listClassBatches);
classBatchRouter.post('/', auditLog('CREATE', 'ClassBatch'), createClassBatch);
classBatchRouter.get('/:id', getClassBatch);
classBatchRouter.put('/:id', auditLog('UPDATE', 'ClassBatch'), updateClassBatch);
classBatchRouter.delete('/:id', auditLog('DELETE', 'ClassBatch'), deleteClassBatch);
classBatchRouter.post('/:id/students', auditLog('ADD_STUDENTS', 'ClassBatch'), addStudentsToBatch);
classBatchRouter.delete('/:id/students/:studentId', auditLog('REMOVE_STUDENT', 'ClassBatch'), removeStudentFromClass);
