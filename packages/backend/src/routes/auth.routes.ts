import { Router, Request, Response, NextFunction } from 'express';
import {
  register,
  verifyUserEmail,
  login,
  logout,
  refreshToken,
  googleCallback,
  updateProfile,
  getProfile,
  uploadAvatar,
  resendVerification,
  requestPasswordReset,
  confirmPasswordReset,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { passport } from '../config/oauth';
import {
  encodeAttributionState,
  parseAttributionFromQuery,
} from '../utils/signup-attribution.util';
import { uploadMiddleware } from '../middleware/upload.middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (email + password)
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify user email address
 * @access  Public
 */
router.post('/verify-email', verifyUserEmail);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user (email + password)
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/v1/auth/password-reset/request-code
 * @desc    Send 6-digit password reset code (expires in 60s)
 * @access  Public (with email) or Private (uses session email)
 */
router.post('/password-reset/request-code', requestPasswordReset);

/**
 * @route   POST /api/v1/auth/password-reset/confirm
 * @desc    Reset password with verification code
 * @access  Public (with email) or Private (uses session email)
 */
router.post('/password-reset/confirm', confirmPasswordReset);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private (requires authentication)
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile (displayName, avatarUrl)
 * @access  Private
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @route   POST /api/v1/auth/avatar
 * @desc    Upload avatar image (png/jpg/jpeg, max 5MB)
 * @access  Private
 */
const avatarUpload = uploadMiddleware.single('avatar');
router.post('/avatar', (req: any, res: any, next: any) => { avatarUpload(req, res, next); }, authenticate, uploadAvatar);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Private (requires authentication)
 */
router.post('/resend-verification', authenticate, resendVerification);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', refreshToken);

// ---- OAuth Routes ----

/**
 * @route   GET /api/v1/auth/google
 * @desc    Initiate Google OAuth login flow
 * @access  Public
 */
router.get(
  '/google',
  (req: Request, res: Response, next: NextFunction) => {
    const attribution = parseAttributionFromQuery(req.query as Record<string, unknown>);
    const state = encodeAttributionState(attribution);
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state,
    })(req, res, next);
  },
);

/**
 * @route   GET /api/v1/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', googleCallback);

export default router;
