import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import {
  addQuestion,
  createBank,
  deleteBank,
  generateTest,
  getBank,
  listBanks,
  removeQuestion,
} from '../controllers/questionBank.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const questionBankRouter = Router();

questionBankRouter.use(requireAuth, staffOnly);

questionBankRouter.get('/', listBanks);
questionBankRouter.post('/', createBank);
questionBankRouter.get('/:id', getBank);
questionBankRouter.delete('/:id', deleteBank);
questionBankRouter.post('/:id/questions', addQuestion);
questionBankRouter.delete('/:id/questions/:questionId', removeQuestion);
questionBankRouter.post('/:id/generate-test', generateTest);
