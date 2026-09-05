import { CookieOptions, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, unauthorized } from '../utils/errors.js';
import { env, isProduction } from '../config/env.js';
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
import { currentUser } from '../middleware/auth.js';
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  getLoginHistory,
  getSecurityOverview,
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
import {
  hashToken,
  listActiveSessions,
  revokeOtherSessions,
  revokeSessionById,
  type SessionMeta,
} from '../services/token.service.js';
import { logAudit } from '../services/audit.service.js';

export const REFRESH_COOKIE = 'refreshToken';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * SameSite=Strict is the first half of the CSRF defence (the origin check in
 * middleware/security.ts is the second). Path is scoped to the auth routes so
 * the cookie is not attached to every API call, which keeps it out of logs and
 * out of reach of any other handler.
 */
const cookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  maxAge: maxAgeMs,
  path: '/api/auth',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, cookieOptions(REFRESH_TTL_MS));

const clearRefreshCookie = (res: Response) =>
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(0), maxAge: undefined });

const metaOf = (req: Request): SessionMeta => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

const readRefreshToken = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_COOKIE] ?? (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const user = await registerUser(input);
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await loginUser(
    input.email,
    input.password,
    input.twoFactorCode,
    metaOf(req),
  );
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken, refreshToken, user } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req);
  if (!token) throw unauthorized('No refresh token provided', 'REFRESH_MISSING');

  try {
    const result = await refreshSession(token, metaOf(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({
      success: true,
      data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user },
    });
  } catch (error) {
    // A dead refresh token must not stay in the browser, or every subsequent
    // page load retries a request that can never succeed.
    if (error instanceof AppError && error.statusCode === 401) clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req);
  await logoutUser(token);
  clearRefreshCookie(res);
  if (req.user) {
    await logAudit({
      userId: req.user.id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(currentUser(req).id);
  res.json({ success: true, data: { user } });
});

export const changePasswordHandler = [
  validate(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await changePassword(
      currentUser(req).id,
      req.body.currentPassword,
      req.body.newPassword,
      metaOf(req),
    );
    // Every session was just revoked, including this one.
    clearRefreshCookie(res);
    res.json({
      success: true,
      data: { message: 'Password changed. Sign in again on your other devices.' },
    });
  }),
];

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
    clearRefreshCookie(res);
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
    const result = await enableTwoFactor(currentUser(req).id, req.body.password);
    res.json({ success: true, data: result });
  }),
];

export const verifyTwoFactorSetupHandler = [
  validate(verifyTwoFactorSetupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await verifyTwoFactorSetup(currentUser(req).id, req.body.code);
    res.json({ success: true, data: { message: 'Two-factor enabled' } });
  }),
];

export const disableTwoFactorHandler = [
  validate(disableTwoFactorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await disableTwoFactor(currentUser(req).id, req.body.password, req.body.code);
    res.json({ success: true, data: { message: 'Two-factor disabled' } });
  }),
];

export const loginHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 20;
  const history = await getLoginHistory(currentUser(req).id, limit);
  res.json({ success: true, data: history });
});

export const securityOverviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSecurityOverview(currentUser(req).id);
  res.json({ success: true, data });
});

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req);
  const sessions = await listActiveSessions(
    currentUser(req).id,
    token ? hashToken(token) : undefined,
  );
  res.json({ success: true, data: sessions });
});

export const revokeSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const revoked = await revokeSessionById(user.id, req.params.id);
  if (revoked === 0) throw new AppError(404, 'Session not found', undefined, 'NOT_FOUND');
  await logAudit({
    userId: user.id,
    action: 'SESSION_REVOKED',
    entity: 'RefreshToken',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json({ success: true, data: { revoked: true } });
});

export const revokeAllSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const token = readRefreshToken(req);
  const revoked = await revokeOtherSessions(user.id, token ? hashToken(token) : undefined);
  await logAudit({
    userId: user.id,
    action: 'ALL_SESSIONS_REVOKED',
    entity: 'User',
    entityId: user.id,
    metadata: { revoked },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json({ success: true, data: { revoked } });
});
