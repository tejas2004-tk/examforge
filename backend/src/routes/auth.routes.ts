import { Router } from 'express';
import {
  changePasswordHandler,
  disableTwoFactorHandler,
  enableTwoFactorHandler,
  forgotPasswordHandler,
  listSessionsHandler,
  login,
  loginHistoryHandler,
  logout,
  me,
  refresh,
  register,
  resendVerificationHandler,
  resetPasswordHandler,
  revokeAllSessionsHandler,
  revokeSessionHandler,
  securityOverviewHandler,
  verifyEmailHandler,
  verifyTwoFactorSetupHandler,
} from '../controllers/auth.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import {
  authLimiter,
  emailVerificationLimiter,
  passwordResetLimiter,
  registrationLimiter,
  twoFactorLimiter,
} from '../middleware/rateLimit.js';

export const authRouter = Router();

// Credential endpoints carry their own limiter on top of the global one; the
// service layer adds a per-account progressive lockout so a distributed guessing
// run cannot get around an IP-keyed limit.
authRouter.post('/register', registrationLimiter, register);
authRouter.post('/login', authLimiter, login);
authRouter.post('/refresh', authLimiter, refresh);
authRouter.post('/logout', optionalAuth, logout);
authRouter.get('/me', requireAuth, me);
authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  auditLog('CHANGE_PASSWORD', 'User'),
  ...changePasswordHandler,
);

authRouter.post('/forgot-password', passwordResetLimiter, ...forgotPasswordHandler);
authRouter.post('/reset-password', passwordResetLimiter, ...resetPasswordHandler);
authRouter.post('/verify-email', emailVerificationLimiter, ...verifyEmailHandler);
authRouter.post('/resend-verification', emailVerificationLimiter, ...resendVerificationHandler);

authRouter.post('/enable-2fa', requireAuth, twoFactorLimiter, ...enableTwoFactorHandler);
authRouter.post('/verify-2fa-setup', requireAuth, twoFactorLimiter, ...verifyTwoFactorSetupHandler);
authRouter.post('/disable-2fa', requireAuth, twoFactorLimiter, ...disableTwoFactorHandler);

authRouter.get('/login-history', requireAuth, loginHistoryHandler);
authRouter.get('/security-overview', requireAuth, securityOverviewHandler);

authRouter.get('/sessions', requireAuth, listSessionsHandler);
authRouter.delete('/sessions/:id', requireAuth, revokeSessionHandler);
authRouter.delete('/sessions', requireAuth, revokeAllSessionsHandler);
