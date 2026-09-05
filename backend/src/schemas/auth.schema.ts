import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  password: z.string().min(8).max(72),
  fullName: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
});

export const refreshSchema = z.object({
  token: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const enableTwoFactorSchema = z.object({
  password: z.string().min(1),
});

export const verifyTwoFactorSetupSchema = z.object({
  code: z.string().length(6),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1),
  code: z.string().length(6),
});