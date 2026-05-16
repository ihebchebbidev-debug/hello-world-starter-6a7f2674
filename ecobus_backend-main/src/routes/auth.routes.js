import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  registerParentSchema,
  refreshSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/schemas.js';
import * as svc from '../services/authService.js';
import * as userSvc from '../services/userService.js';
import * as phoneOtp from '../services/phoneOtpService.js';

const router = Router();

const ctx = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ip: req.ip,
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new organization + initial admin user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Email already registered }
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.registerOrgAndAdmin(req.body, ctx(req)))),
);

/**
 * @openapi
 * /auth/register-parent:
 *   post:
 *     tags: [Auth]
 *     summary: Self-register a parent under an existing organization
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterParentInput' }
 *     responses:
 *       201: { description: Created }
 */
router.post(
  '/register-parent',
  authLimiter,
  validate(registerParentSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.registerParent(req.body, ctx(req)))),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate; returns access + refresh tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Invalid credentials }
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => res.json(await svc.login(req.body, ctx(req)))),
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access token (with rotation)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Invalid/expired refresh token }
 */
router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  asyncHandler(async (req, res) =>
    res.json(await svc.refresh(req.body.refreshToken, ctx(req)))),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current authenticated user
 *     responses:
 *       200: { description: OK }
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => res.json(await svc.me(req.user.id))));

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     tags: [Auth]
 *     summary: Update the current user's profile
 *     responses:
 *       200: { description: OK }
 */
router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => res.json(await userSvc.updateOwnProfile(req.user.id, req.body))),
);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change the current user's password
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) =>
    res.json(await userSvc.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword))),
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the supplied refresh token (access tokens remain valid until expiry)
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => res.json(await svc.logout(req.body?.refreshToken))),
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset (stub — always returns OK)
 *     security: []
 */
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (_req, res) => {
    // Stub: e-mail delivery isn't wired yet. Always respond OK so we don't
    // leak which addresses are registered.
    res.json({ ok: true });
  }),
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a recovery token (stub)
 *     security: []
 */
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (_req, res) => res.json({ ok: true })),
);

/**
 * @openapi
 * /auth/me:
 *   delete:
 *     tags: [Auth]
 *     summary: Soft-delete the authenticated user's account
 */
router.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    await userSvc.deleteUser(req.user.organizationId, req.user.id).catch(() => {});
    await svc.logout(req.body?.refreshToken).catch(() => {});
    res.json({ ok: true });
  }),
);

/**
 * @openapi
 * /auth/phone-otp/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request a phone OTP. Until SMS is wired, returns the code in `devCode`.
 *     security: []
 */
router.post(
  '/phone-otp/request',
  authLimiter,
  asyncHandler(async (req, res) => res.json(await phoneOtp.requestOtp(req.body?.phone))),
);

/**
 * @openapi
 * /auth/phone-otp/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify a phone OTP code.
 *     security: []
 */
router.post(
  '/phone-otp/verify',
  authLimiter,
  asyncHandler(async (req, res) =>
    res.json(await phoneOtp.verifyOtp(req.body?.phone, req.body?.code))),
);

/**
 * @openapi
 * /auth/phone-otp/login:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and mint a session for the user owning that phone.
 *     security: []
 */
router.post(
  '/phone-otp/login',
  authLimiter,
  asyncHandler(async (req, res) =>
    res.json(await svc.loginWithPhone(
      { phone: req.body?.phone, code: req.body?.code },
      ctx(req),
    ))),
);

export default router;
