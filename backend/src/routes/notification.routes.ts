import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';

export const notificationRouter = Router();

notificationRouter.get('/', requireAuth, ...listNotifications);
notificationRouter.get('/unread-count', requireAuth, getUnreadCount);
notificationRouter.post('/read-all', requireAuth, markAllAsRead);
notificationRouter.post('/:id/read', requireAuth, markAsRead);
