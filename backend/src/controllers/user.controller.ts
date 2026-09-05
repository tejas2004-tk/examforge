import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { currentUser } from '../middleware/auth.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
} from '../schemas/user.schema.js';
import * as userService from '../services/user.service.js';
import { getPreferences, preferencesPatchSchema, updatePreferences } from '../services/preferences.service.js';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  listUsersQuerySchema.parse(req.query);
  const data = await userService.listUsers(req.query);
  res.json({ success: true, data });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await userService.createUser(currentUser(req), input);
  res.status(201).json({ success: true, data: { user } });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await userService.updateUser(currentUser(req), req.params.id, input, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json({ success: true, data: { user } });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(currentUser(req), req.params.id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json({ success: true, data: null });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await userService.updateOwnProfile(currentUser(req).id, input);
  res.json({ success: true, data: { user } });
});

export const getMyPreferences = asyncHandler(async (req: Request, res: Response) => {
  const preferences = await getPreferences(currentUser(req).id);
  res.json({ success: true, data: preferences });
});

export const patchMyPreferences = asyncHandler(async (req: Request, res: Response) => {
  const patch = preferencesPatchSchema.parse(req.body ?? {});
  const preferences = await updatePreferences(currentUser(req).id, patch);
  res.json({ success: true, data: preferences });
});
