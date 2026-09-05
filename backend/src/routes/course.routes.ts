import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createCourse,
  deleteCourse,
  getCourse,
  listCourses,
  updateCourse,
} from '../controllers/course.controller.js';

export const courseRouter = Router();

courseRouter.use(requireAuth);

courseRouter.get('/', listCourses);
courseRouter.get('/:id', getCourse);
courseRouter.post('/', requireRole('ADMIN', 'TEACHER'), auditLog('CREATE', 'Course'), createCourse);
courseRouter.put('/:id', requireRole('ADMIN', 'TEACHER'), auditLog('UPDATE', 'Course'), updateCourse);
courseRouter.delete('/:id', requireRole('ADMIN', 'TEACHER'), auditLog('DELETE', 'Course'), deleteCourse);
