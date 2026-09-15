import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';
import {
  register,
  requestLoginOtp,
  verifyOtp,
  refreshSession,
  revokeRefreshToken,
  findUserById,
  publicUser,
} from '../services/auth.service.js';

const router = Router();
const REFRESH_COOKIE = 'gymc_rt';

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  role: z.enum(['member', 'leader']),
  phone: z.string().max(40).optional(),
});

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    ok(res, result, 201);
  }),
);

// Accept an email or a choir member number. `email` is kept as a legacy alias
// so existing callers keep working.
const identifierSchema = z
  .object({
    identifier: z.string().trim().min(3).max(160).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.identifier || d.email, {
    message: 'Provide a member number or email',
  });

router.post(
  '/request-otp',
  authLimiter,
  validate(identifierSchema),
  asyncHandler(async (req, res) => {
    ok(res, await requestLoginOtp(req.body.identifier || req.body.email));
  }),
);

router.post(
  '/verify-otp',
  authLimiter,
  validate(
    identifierSchema.and(
      z.object({
        code: z.string().regex(/^\d{6}$/),
      }),
    ),
  ),
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken, refreshExpiresAt } = await verifyOtp({
      ...req.body,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    ok(res, { user, accessToken });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    const { user, accessToken, refreshToken, refreshExpiresAt } = await refreshSession({
      refreshToken: token,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    ok(res, { user, accessToken });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken);
    clearRefreshCookie(res);
    ok(res, { loggedOut: true });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = publicUser(await findUserById(req.user.id));
    ok(res, { user });
  }),
);

export default router;
