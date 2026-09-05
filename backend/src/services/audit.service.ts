import { prisma } from '../config/database.js';

export async function logAudit(data: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      metadata: data.metadata as any,
      ip: data.ip,
      userAgent: data.userAgent,
    },
  });
}

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  entity?: string;
  userId?: string;
  action?: string;
}) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (query.entity) where.entity = query.entity;
  if (query.userId) where.userId = query.userId;
  if (query.action) where.action = query.action;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, limit };
}
