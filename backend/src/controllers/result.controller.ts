import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as resultService from '../services/result.service.js';

export const listResults = asyncHandler(async (req: Request, res: Response) => {
  const data = await resultService.listResultsForStudent(req.user!.id, req.query);
  res.json({ success: true, data });
});

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const data = await resultService.listSubmissions(req.user!, req.query);
  res.json({ success: true, data });
});

export const getResultDetail = asyncHandler(async (req: Request, res: Response) => {
  const data = await resultService.getResultDetail(req.params.id, req.user!);
  res.json({ success: true, data });
});
