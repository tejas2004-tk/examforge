import { prisma } from '../config/database.js';

export async function createNotification(data: {
  userId: string;
  type?: string;
  title: string;
  message?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: (data.type as any) ?? 'SYSTEM',
      title: data.title,
      message: data.message,
    },
  });
}

export async function createManyNotifications(
  items: Array<{ userId: string; type?: string; title: string; message?: string }>,
) {
  if (items.length === 0) return;
  return prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: (item.type as any) ?? 'SYSTEM',
      title: item.title,
      message: item.message,
    })),
  });
}

export async function listNotifications(
  userId: string,
  query: { page: number; limit: number; unreadOnly?: boolean },
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const where: any = { userId };
  if (query.unreadOnly) where.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { items, total, unreadCount, page, limit };
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) return null;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: true };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
}
