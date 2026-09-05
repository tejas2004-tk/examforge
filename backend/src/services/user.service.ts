import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import { hashPassword } from '../utils/password.js';
import type { CreateUserInput, UpdateUserInput } from '../schemas/user.schema.js';

const publicUser = (u: {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  isBlocked: boolean;
  dob: Date | null;
  qualification: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  isActive: u.isActive,
  isBlocked: u.isBlocked,
  dob: u.dob,
  qualification: u.qualification,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

export const listUsers = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.UserWhereInput = {};
  if (typeof query.role === 'string') where.role = query.role as Role;
  if (typeof query.search === 'string' && query.search.trim()) {
    where.OR = [
      { email: { contains: query.search.trim() } },
      { username: { contains: query.search.trim() } },
      { fullName: { contains: query.search.trim() } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        isBlocked: true,
        dob: true,
        qualification: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: items.map(publicUser), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const createUser = async (adminId: string, input: CreateUserInput) => {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: input.username }] },
  });
  if (existing) throw new AppError(409, 'Email or username already in use');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      role: input.role,
    },
    select: {
      id: true, email: true, username: true, fullName: true, role: true,
      isActive: true, isBlocked: true, dob: true, qualification: true, lastLoginAt: true, createdAt: true,
    },
  });
  return publicUser(user);
};

export const updateUser = async (adminId: string, userId: string, input: UpdateUserInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const isSelf = adminId === userId;
  if (isSelf && input.role && input.role !== Role.ADMIN) {
    throw new AppError(400, 'You cannot remove your own admin role');
  }
  if (isSelf && (input.isActive === false || input.isBlocked === true)) {
    throw new AppError(400, 'You cannot block or deactivate your own account');
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.role) data.role = input.role;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.isBlocked !== undefined) data.isBlocked = input.isBlocked;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, email: true, username: true, fullName: true, role: true,
      isActive: true, isBlocked: true, dob: true, qualification: true, lastLoginAt: true, createdAt: true,
    },
  });
  return publicUser(updated);
};

export const deleteUser = async (adminId: string, userId: string) => {
  if (adminId === userId) throw new AppError(400, 'You cannot delete your own account');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  await prisma.user.delete({ where: { id: userId } });
};
