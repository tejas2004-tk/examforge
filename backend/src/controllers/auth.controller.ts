import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  enableTwoFactorSchema,
  verifyTwoFactorSetupSchema,
  disableTwoFactorSchema,
} from '../schemas/auth.schema.js';
import { validate } from '../middleware/validate.js';
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  getLoginHistory,
  getUserById,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  resendVerification,
  resetPassword,
  verifyEmail,
  verifyTwoFactorSetup,
} from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: maxAgeMs,
  path: '/',
});

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, cookieOptions(REFRESH_TTL_MS));

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const user = await registerUser(input);
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const meta = { ip: req.ip, userAgent: req.get('user-agent') };
  const { accessToken, refreshToken, user } = await loginUser(
    input.email,
    input.password,
    input.twoFactorCode,
    meta,
  );
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken, refreshToken, user } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!token) throw new AppError(401, 'No refresh token provided');

  const { accessToken, refreshToken, user } = await refreshSession(token);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken, refreshToken, user } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  await logoutUser(token);
  res.clearCookie(REFRESH_COOKIE);
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.user!.id);
  res.json({ success: true, data: { user } });
});

export const changePasswordHandler = [
  validate(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    await changePassword(user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true, data: { message: 'Password changed successfully' } });
  }),
];

// --- Phase 17: Enhanced Auth Handlers ---

export const forgotPasswordHandler = [
  validate(forgotPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await forgotPassword(req.body.email);
    res.json({ success: true, data: result });
  }),
];

export const resetPasswordHandler = [
  validate(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await resetPassword(req.body.token, req.body.newPassword);
    res.json({ success: true, data: { message: 'Password reset successfully' } });
  }),
];

export const verifyEmailHandler = [
  validate(verifyEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await verifyEmail(req.body.token);
    res.json({ success: true, data: { message: 'Email verified successfully' } });
  }),
];

export const resendVerificationHandler = [
  validate(resendVerificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await resendVerification(req.body.email);
    res.json({ success: true, data: result });
  }),
];

export const enableTwoFactorHandler = [
  validate(enableTwoFactorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await enableTwoFactor(req.user!.id, req.body.password);
    res.json({ success: true, data: result });
  }),
];

export const verifyTwoFactorSetupHandler = [
  validate(verifyTwoFactorSetupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await verifyTwoFactorSetup(req.user!.id, req.body.code);
    res.json({ success: true, data: { message: 'Two-factor enabled' } });
  }),
];

export const disableTwoFactorHandler = [
  validate(disableTwoFactorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await disableTwoFactor(req.user!.id, req.body.password, req.body.code);
    res.json({ success: true, data: { message: 'Two-factor disabled' } });
  }),
];

export const loginHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const history = await getLoginHistory(req.user!.id, limit);
  res.json({ success: true, data: { history } });
});