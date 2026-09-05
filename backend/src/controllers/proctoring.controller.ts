import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createProctoringSessionSchema,
  logProctoringEventSchema,
  captureSnapshotSchema,
  alertStudentSchema,
} from '../schemas/proctoring.schema.js';
import * as proctoringService from '../services/proctoring.service.js';

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const input = createProctoringSessionSchema.parse(req.body);
  const session = await proctoringService.createProctoringSession(input);
  res.status(201).json({ success: true, data: { session } });
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const result = await proctoringService.getAllSessions({
    status,
    page: Number(req.query.page),
    limit: Number(req.query.limit),
  });
  res.json({ success: true, data: result });
});

export const listActiveSessions = asyncHandler(async (req: Request, res: Response) => {
const sessions = await proctoringService.listActiveSessions();
    res.json({ success: true, data: { sessions } });
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await proctoringService.getSessionDetail(req.params.sessionId);
  res.json({ success: true, data: { session } });
});

export const endSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await proctoringService.endProctoringSession(req.params.sessionId);
  res.json({ success: true, data: { session } });
});

export const logEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = logProctoringEventSchema.parse(req.body);
  const event = await proctoringService.logProctoringEvent(req.params.sessionId, input);
  res.status(201).json({ success: true, data: { event } });
});

export const captureSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const input = captureSnapshotSchema.parse(req.body);
  const snapshot = await proctoringService.captureSnapshot(req.params.sessionId, input);
  res.status(201).json({ success: true, data: { snapshot } });
});

export const alertStudent = asyncHandler(async (req: Request, res: Response) => {
  const input = alertStudentSchema.parse(req.body);
  const result = await proctoringService.alertStudent(req.params.sessionId, input.message);
  res.json({ success: true, data: result });
});

export const recomputeSuspicion = asyncHandler(async (_req: Request, res: Response) => {
  const result = await proctoringService.computeGlobalSuspicion();
  res.json({ success: true, data: result });
});