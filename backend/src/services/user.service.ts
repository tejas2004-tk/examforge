import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors.js';
import { orderBy, paged, parsePagination, parseSearch, parseSort } from '../utils/pagination.js';
import { assertPasswordStrength, hashPassword } from '../utils/password.js';
import { logAudit } from './audit.service.js';
import { revokeAllUserTokens } from './token.service.js';
import type { CreateUserInput, UpdateProfileInput, UpdateUserInput } from '../schemas/user.schema.js';
import type { Viewer } from './access.service.js';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  isBlocked: true,
  isEmailVerified: true,
  twoFactorEnabled: true,
  dob: true,
  qualification: true,
  avatarUrl: true,
  lastLoginAt: true,
  lastPasswordChangeAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const SORTABLE = ['createdAt', 'email', 'username', 'fullName', 'role', 'lastLoginAt'] as const;

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export const listUsers = async (query: Record<string, unknown>) => {
  const pagination = parsePagination(query);
  const sort = parseSort(query, SORTABLE, 'createdAt');
  const search = parseSearch(query);

  const where: Prisma.UserWhereInput = {};
  if (typeof query.role === 'string') where.role = query.role as Role;
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { username: { contains: search } },
      { fullName: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: orderBy(sort),
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return paged(items, pagination, total);
};

export const createUser = async (actor: Viewer, input: CreateUserInput) => {
  const email = input.email.toLowerCase();
  assertPasswordStrength(input.password, {
    email,
    username: input.username,
    fullName: input.fullName,
  });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: input.username }] },
  });
  if (existing) throw new AppError(409, 'Email or username already in use', undefined, 'CONFLICT');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      role: input.role,
      lastPasswordChangeAt: new Date(),
    },
    select: PUBLIC_SELECT,
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user.id,
    metadata: { role: input.role },
  });
  return user;
};

export const updateUser = async (
  actor: Viewer,
  userId: string,
  input: UpdateUserInput,
  meta: RequestMeta = {},
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  const isSelf = actor.id === userId;
  if (isSelf && input.role && input.role !== user.role) {
    throw badRequest('You cannot change your own role');
  }
  if (isSelf && (input.isActive === false || input.isBlocked === true)) {
    throw badRequest('You cannot block or deactivate your own account');
  }

  // Demoting or disabling the last administrator would lock everyone out of the
  // console, so the operation is refused rather than leaving an orphaned system.
  const losingAdmin =
    user.role === Role.ADMIN &&
    ((input.role && input.role !== Role.ADMIN) || input.isActive === false || input.isBlocked === true);
  if (losingAdmin) {
    const remaining = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, isBlocked: false, id: { not: userId } },
    });
    if (remaining === 0) throw badRequest('At least one active administrator must remain');
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.role) data.role = input.role;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.isBlocked !== undefined) data.isBlocked = input.isBlocked;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.user.update({ where: { id: userId }, data, select: PUBLIC_SELECT });

  // A blocked or demoted account keeps working until its access token expires
  // unless its refresh tokens are dropped now.
  const accessChanged =
    (input.role && input.role !== user.role) || input.isActive === false || input.isBlocked === true;
  if (accessChanged) await revokeAllUserTokens(userId, 'privileges_changed');

  if (input.role && input.role !== user.role) {
    await logAudit({
      userId: actor.id,
      action: 'ROLE_CHANGED',
      entity: 'User',
      entityId: userId,
      metadata: { from: user.role, to: input.role },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  if (input.isBlocked !== undefined && input.isBlocked !== user.isBlocked) {
    await logAudit({
      userId: actor.id,
      action: input.isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
      entity: 'User',
      entityId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  return updated;
};

export const deleteUser = async (actor: Viewer, userId: string, meta: RequestMeta = {}) => {
  if (actor.id === userId) throw badRequest('You cannot delete your own account');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  if (user.role === Role.ADMIN) {
    const remaining = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true, isBlocked: false, id: { not: userId } },
    });
    if (remaining === 0) throw badRequest('At least one active administrator must remain');
  }

  await prisma.user.delete({ where: { id: userId } });
  await logAudit({
    userId: actor.id,
    action: 'USER_DELETED',
    entity: 'User',
    entityId: userId,
    metadata: { email: user.email, role: user.role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
};

export const updateOwnProfile = async (userId: string, input: UpdateProfileInput) => {
  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.dob !== undefined) data.dob = input.dob ? new Date(input.dob) : null;
  if (input.qualification !== undefined) data.qualification = input.qualification;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

  if (Object.keys(data).length === 0) throw badRequest('No profile fields supplied');

  return prisma.user.update({ where: { id: userId }, data, select: PUBLIC_SELECT });
};

/** Used by staff-facing pickers; deliberately narrower than listUsers. */
export const searchStudents = async (search?: string, limit = 50) => {
  const where: Prisma.UserWhereInput = { role: Role.STUDENT, isActive: true, isBlocked: false };
  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { email: { contains: term } },
      { username: { contains: term } },
      { fullName: { contains: term } },
    ];
  }
  return prisma.user.findMany({
    where,
    select: { id: true, fullName: true, email: true, username: true },
    orderBy: { email: 'asc' },
    take: Math.min(200, limit),
  });
};

export const assertNotSelf = (actor: Viewer, userId: string) => {
  if (actor.id === userId) throw forbidden('This action cannot target your own account');
};
