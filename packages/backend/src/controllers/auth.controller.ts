import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  verifyEmail,
  loginUser,
  logoutUser,
  refreshAccessToken,
  resendVerificationEmail,
  requestPasswordResetCode,
  resetPasswordWithCode,
} from '../services/auth.service';
import {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  refreshTokenSchema,
  passwordResetCodeRequestSchema,
  passwordResetConfirmSchema,
} from '../validators/auth.validator';
import { ZodError } from 'zod';
import { sendVerificationEmail } from '../services/email.service';
import logger from '../lib/logger';
import { passport } from '../config/oauth';
import { TaskService } from '../services/task.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedData = registerSchema.parse(req.body);
    const ipAddress = (req.ip || req.socket.remoteAddress) as string;
    const userAgent = req.get('user-agent');
    const { user, verificationToken } = await registerUser(validatedData, {
      ipAddress,
      userAgent,
      attribution: validatedData.attribution,
    });

    // Send verification email (non-blocking - registration succeeds even if email fails)
    try {
      const emailResult = await sendVerificationEmail(user.email, verificationToken);
      if (!emailResult.success) {
        logger.warn(`Failed to send verification email to ${user.email}`, { error: emailResult.error });
      }
    } catch (emailError) {
      logger.error('Error sending verification email', { error: emailError instanceof Error ? emailError.message : 'Unknown error' });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        userId: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

/**
 * Verify user email
 * POST /api/v1/auth/verify-email
 */
export async function verifyUserEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const user = await verifyEmail(token);

    // Record task event for email verification (fire-and-forget)
    try {
      await TaskService.recordEvent(user.id, 'verify_email', 1);
    } catch {
      // Non-critical
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired') ||
        error.message.includes('already verified')
      ) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }
    }

    next(error);
  }
}

/**
 * Login user
 * POST /api/v1/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedData = loginSchema.parse(req.body);
    const ipAddress = (req.ip || req.socket.remoteAddress) as string;
    const userAgent = req.get('user-agent');
    const { user, tokens } = await loginUser(validatedData, ipAddress, userAgent);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          tier: user.tier,
          locale: user.locale,
          emailVerified: user.emailVerified,
          displayName: user.displayName || null,
          avatarUrl: user.avatarUrl || null,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid email or password')) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }

      if (error.message.includes('locked')) {
        res.status(423).json({
          success: false,
          error: 'Locked',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const sessionId = (req as any).sessionId;

    if (!userId || !sessionId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    await logoutUser(userId, sessionId);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken: rt } = refreshTokenSchema.parse(req.body);
    const tokens = await refreshAccessToken(rt);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

// ---- OAuth Callback Handlers ----

function handleOAuthCallback(
  provider: string,
  req: Request,
  res: Response
) {
  passport.authenticate(provider, { session: false }, (err: Error | null, data?: { userId: string; email: string; displayName?: string | null; avatarUrl?: string | null; emailVerified?: boolean; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }) => {
    if (err || !data) {
      const errorMsg = encodeURIComponent(err?.message || `${provider} authentication failed`);
      return res.redirect(`${FRONTEND_URL}/login?oauthError=${errorMsg}`);
    }

    // Pass token data to frontend via base64-encoded query param
    const tokenData = JSON.stringify({
      user: { id: data.userId, email: data.email, displayName: data.displayName || null, avatarUrl: data.avatarUrl || null, emailVerified: data.emailVerified ?? true },
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresIn: data.tokens.expiresIn,
    });
    const encoded = Buffer.from(tokenData).toString('base64');
    res.redirect(`${FRONTEND_URL}/login?oauth=${encodeURIComponent(encoded)}`);
  })(req, res);
}

/**
 * Google OAuth callback
 * GET /api/v1/auth/google/callback
 */
export function googleCallback(req: Request, res: Response): void {
  handleOAuthCallback('google', req, res);
}

/**
 * Update user profile (username, avatar)
 * PUT /api/v1/auth/profile
 */
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { displayName, avatarUrl } = req.body;

    const { prisma } = await import('../lib/prisma');
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName: String(displayName).trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: String(avatarUrl).trim() || null }),
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload avatar image and update user's avatarUrl
 * POST /api/v1/auth/avatar
 */
export async function uploadAvatar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mreq = req as Request & { file?: Express.Multer.File };
    if (!mreq.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const userId = req.user!.id;
    const avatarUrl = `/uploads/attachments/${mreq.file.filename}`;

    const { prisma } = await import('../lib/prisma');
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile
 * GET /api/v1/auth/profile
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, locale: true, emailVerified: true },
    });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    // Sync verify_email task for OAuth / already-verified users
    if (user.emailVerified) {
      try {
        await TaskService.recordEvent(userId, 'verify_email', 1);
      } catch {
        // Non-critical
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;

    const { email, verificationToken } = await resendVerificationEmail(userId);

    // Send verification email (non-blocking)
    try {
      const emailResult = await sendVerificationEmail(email, verificationToken);
      if (!emailResult.success) {
        logger.warn(`Failed to resend verification email to ${email}`, { error: emailResult.error });
      }
    } catch (emailError) {
      logger.error('Error resending verification email', { error: emailError instanceof Error ? emailError.message : 'Unknown error' });
    }

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already verified')) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
    }

    next(error);
  }
}

/**
 * Request password reset verification code
 * POST /api/v1/auth/password-reset/request-code
 */
export async function requestPasswordReset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email: bodyEmail } = passwordResetCodeRequestSchema.parse(req.body);
    const email = bodyEmail || req.user?.email;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email is required',
      });
      return;
    }

    await requestPasswordResetCode(email);

    res.status(200).json({
      success: true,
      message: 'If this email is registered, a verification code has been sent. The code expires in 1 minute.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      const status = error.message.includes('Too many') ? 429 : 400;
      res.status(status).json({
        success: false,
        error: status === 429 ? 'Too Many Requests' : 'Bad Request',
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

/**
 * Confirm password reset with verification code
 * POST /api/v1/auth/password-reset/confirm
 */
export async function confirmPasswordReset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email: bodyEmail, code, newPassword } = passwordResetConfirmSchema.parse(req.body);
    const email = bodyEmail || req.user?.email;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email is required',
      });
      return;
    }

    await resetPasswordWithCode(email, code, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
