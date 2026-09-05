import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as notificationService from '../services/notification.service.js';
import { validate } from '../middleware/validate.js';
import { listNotificationsQuerySchema } from '../schemas/notification.schema.js';

export const listNotifications = [
  validate(listNotificationsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await notificationService.listNotifications(user.id, req.query as any);
    res.json({ success: true, data: result });
  }),
];

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await notificationService.getUnreadCount(user.id);
  res.json({ success: true, data: result });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const notification = await notificationService.markAsRead(req.params.id, user.id);
  if (!notification) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }
  res.json({ success: true, data: { notification } });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await notificationService.markAllAsRead(user.id);
  res.json({ success: true, data: result });
});
