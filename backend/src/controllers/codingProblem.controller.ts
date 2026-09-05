import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createCodingProblemSchema,
  updateCodingProblemSchema,
  executeCodeSchema,
  addTestCaseSchema,
} from '../schemas/codingProblem.schema.js';
import * as codingService from '../services/codingProblem.service.js';
import { prisma } from '../config/database.js';

export const createProblem = asyncHandler(async (req: Request, res: Response) => {
  const input = createCodingProblemSchema.parse(req.body);
  const problem = await codingService.createCodingProblem({ ...input, createdById: req.user!.id });
  res.status(201).json({ success: true, data: { problem } });
});

export const listProblems = asyncHandler(async (req: Request, res: Response) => {
  const result = await codingService.listCodingProblems({
    page: Number(req.query.page),
    limit: Number(req.query.limit),
    courseId: req.query.courseId as string | undefined,
  }, req.user!.role);
  res.json({ success: true, data: result });
});

export const getProblem = asyncHandler(async (req: Request, res: Response) => {
  const problem = await codingService.getCodingProblem(req.params.id, req.user!.id, req.user!.role);
  res.json({ success: true, data: { problem } });
});

export const updateProblem = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCodingProblemSchema.parse(req.body);
  const problem = await codingService.updateCodingProblem(req.params.id, req.user!, input);
  res.json({ success: true, data: { problem } });
});

export const deleteProblem = asyncHandler(async (req: Request, res: Response) => {
  await codingService.deleteCodingProblem(req.params.id, req.user!);
  res.json({ success: true, data: null });
});

export const executeCode = asyncHandler(async (req: Request, res: Response) => {
  const input = executeCodeSchema.parse(req.body);
  const result = await codingService.executeCode(req.params.id, req.user!.id, input.language, input.code);
  res.json({ success: true, data: result });
});

export const addTestCase = asyncHandler(async (req: Request, res: Response) => {
  const input = addTestCaseSchema.parse(req.body);
  const testCase = await codingService.addTestCase(req.params.id, input);
  res.status(201).json({ success: true, data: { testCase } });
});

export const deleteTestCase = asyncHandler(async (req: Request, res: Response) => {
  await codingService.deleteTestCase(req.params.testCaseId);
  res.json({ success: true, data: null });
});

export const listProblemSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const isStaff = req.user!.role === 'ADMIN' || req.user!.role === 'TEACHER';
  const submissions = await codingService.listSubmissions(
    req.params.id,
    isStaff ? undefined : req.user!.id,
  );
  res.json({ success: true, data: { submissions } });
});

export const getSubmission = asyncHandler(async (req: Request, res: Response) => {
  const submission = await codingService.getSubmission(req.params.submissionId, req.user!);
  res.json({ success: true, data: { submission } });
});

// Add a question linked to a coding problem
export const createQuestionFromProblem = asyncHandler(async (req: Request, res: Response) => {
  const problem = await prisma.codingProblem.findUnique({ where: { id: req.params.id } });
  if (!problem) {
    res.status(404).json({ success: false, message: 'Coding problem not found' });
    return;
  }
  const question = await prisma.question.create({
    data: {
      text: problem.title,
      type: 'CODING',
      difficulty: problem.difficulty,
      marks: 10,
      createdById: req.user!.id,
      // Store reference to coding problem
      reference: problem.id,
    },
  });
  res.status(201).json({ success: true, data: { question } });
});