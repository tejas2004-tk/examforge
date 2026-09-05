import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignmentHandler,
  gradeSubmission,
  listMySubmissions,
} from '../controllers/assignment.controller.js';

export const assignmentRouter = Router();

// Teacher/Admin: create and manage assignments
assignmentRouter.post('/', requireAuth, requireRole('ADMIN', 'TEACHER'), auditLog('CREATE', 'Assignment'), ...createAssignment);
assignmentRouter.get('/', requireAuth, requireRole('ADMIN', 'TEACHER', 'STUDENT'), ...listAssignments);

// Student: list my submissions
assignmentRouter.get('/my-submissions', requireAuth, requireRole('STUDENT'), listMySubmissions);

// Student: submit assignment
assignmentRouter.post('/:id/submit', requireAuth, requireRole('STUDENT'), auditLog('SUBMIT', 'Assignment'), ...submitAssignmentHandler);

// Teacher: grade a submission
assignmentRouter.post('/:id/submissions/:submissionId/grade', requireAuth, requireRole('ADMIN', 'TEACHER'), auditLog('GRADE', 'Assignment'), ...gradeSubmission);

// Get single assignment (role-aware)
assignmentRouter.get('/:id', requireAuth, getAssignment);

// Teacher/Admin: update and delete
assignmentRouter.put('/:id', requireAuth, requireRole('ADMIN', 'TEACHER'), auditLog('UPDATE', 'Assignment'), ...updateAssignment);
assignmentRouter.delete('/:id', requireAuth, requireRole('ADMIN', 'TEACHER'), auditLog('DELETE', 'Assignment'), deleteAssignment);
