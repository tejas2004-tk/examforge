import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from '../schemas/user.schema.js';
import * as userService from '../services/user.service.js';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  listUsersQuerySchema.parse(req.query);
  const data = await userService.listUsers(req.query);
  res.json({ success: true, data });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await userService.createUser(req.user!.id, input);
  res.status(201).json({ success: true, data: { user } });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await userService.updateUser(req.user!.id, req.params.id, input);
  res.json({ success: true, data: { user } });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req.user!.id, req.params.id);
  res.json({ success: true, data: null });
});
