import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createProblem,
  listProblems,
  getProblem,
  updateProblem,
  deleteProblem,
  executeCode,
  addTestCase,
  deleteTestCase,
  listProblemSubmissions,
  getSubmission,
  createQuestionFromProblem,
} from '../controllers/codingProblem.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const codingProblemRouter = Router();

codingProblemRouter.use(requireAuth);

codingProblemRouter.get('/', listProblems);
codingProblemRouter.post('/', staffOnly, auditLog('CREATE', 'CodingProblem'), createProblem);
codingProblemRouter.get('/:id', getProblem);
codingProblemRouter.put('/:id', staffOnly, auditLog('UPDATE', 'CodingProblem'), updateProblem);
codingProblemRouter.delete('/:id', staffOnly, auditLog('DELETE', 'CodingProblem'), deleteProblem);

codingProblemRouter.post('/:id/execute', executeCode);
codingProblemRouter.post('/:id/testcases', staffOnly, addTestCase);
codingProblemRouter.delete('/:id/testcases/:testCaseId', staffOnly, deleteTestCase);
codingProblemRouter.get('/:id/submissions', listProblemSubmissions);
codingProblemRouter.get('/:id/submissions/:submissionId', getSubmission);
codingProblemRouter.post('/:id/link-question', staffOnly, createQuestionFromProblem);