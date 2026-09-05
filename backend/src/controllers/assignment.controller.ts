import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as assignmentService from '../services/assignment.service.js';
import { validate } from '../middleware/validate.js';
import { createAssignmentSchema, updateAssignmentSchema, submitAssignmentSchema, gradeSubmissionSchema, listAssignmentsQuerySchema } from '../schemas/assignment.schema.js';

export const createAssignment = [
  validate(createAssignmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const assignment = await assignmentService.createAssignment({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json({ success: true, data: { assignment } });
  }),
];

export const listAssignments = [
  validate(listAssignmentsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await assignmentService.listAssignments(user.id, user.role, req.query as any);
    res.json({ success: true, data: result });
  }),
];

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const assignment = await assignmentService.getAssignment(req.params.id, user.id, user.role);
  res.json({ success: true, data: { assignment } });
});

export const updateAssignment = [
  validate(updateAssignmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const assignment = await assignmentService.updateAssignment(req.params.id, user.id, user.role, req.body);
    res.json({ success: true, data: { assignment } });
  }),
];

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  await assignmentService.deleteAssignment(req.params.id, user.id, user.role);
  res.json({ success: true, data: { deleted: true } });
});

export const submitAssignmentHandler = [
  validate(submitAssignmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const submission = await assignmentService.submitAssignment(req.params.id, user.id, req.body);
    res.json({ success: true, data: { submission } });
  }),
];

export const gradeSubmission = [
  validate(gradeSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const submission = await assignmentService.gradeSubmission(req.params.submissionId, (req as any).user.id, req.body);
    res.json({ success: true, data: { submission } });
  }),
];

export const listMySubmissions = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const submissions = await assignmentService.listMySubmissions(user.id);
  res.json({ success: true, data: { items: submissions } });
});
