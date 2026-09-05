import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changePasswordHandler,
  login,
  logout,
  me,
  refresh,
  register,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  enableTwoFactorHandler,
  verifyTwoFactorSetupHandler,
  disableTwoFactorHandler,
  loginHistoryHandler,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.use(authLimiter);
authRouter.post('/register', auditLog('REGISTER', 'User'), register);
authRouter.post('/login', auditLog('LOGIN', 'User'), login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', auditLog('LOGOUT', 'User'), logout);
authRouter.get('/me', requireAuth, me);
authRouter.post('/change-password', requireAuth, auditLog('CHANGE_PASSWORD', 'User'), ...changePasswordHandler);

// --- Phase 17: Enhanced Auth ---
authRouter.post('/forgot-password', forgotPasswordHandler);
authRouter.post('/reset-password', resetPasswordHandler);
authRouter.post('/verify-email', verifyEmailHandler);
authRouter.post('/resend-verification', resendVerificationHandler);
authRouter.post('/enable-2fa', requireAuth, enableTwoFactorHandler);
authRouter.post('/verify-2fa-setup', requireAuth, verifyTwoFactorSetupHandler);
authRouter.post('/disable-2fa', requireAuth, disableTwoFactorHandler);
authRouter.get('/login-history', requireAuth, loginHistoryHandler);