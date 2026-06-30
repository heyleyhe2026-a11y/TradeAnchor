import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password.util';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { generateVerificationToken, generateSixDigitCode, isTokenExpired } from '../utils/token.util';
import { getRedisClient, RedisKeys, RedisTTL } from '../lib/redis';
import { sendPasswordResetCodeEmail } from './email.service';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import {
  attributionToAuditMetadata,
  normalizeSignupAttribution,
  SignupAttributionInput,
} from '../utils/signup-attribution.util';
import { v4 as uuidv4 } from 'uuid';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponse {
  id: string;
  email: string;
  tier: string;
  locale: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Register a new user
 */
export async function registerUser(
  data: RegisterInput,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    attribution?: SignupAttributionInput | null;
  },
): Promise<{
  user: UserResponse;
  verificationToken: string;
}> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Generate verification token
  const { token: verificationToken, expiresAt } = generateVerificationToken();

  const signupAttribution = normalizeSignupAttribution(data.attribution ?? options?.attribution);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      countryCode: data.countryCode,
      verificationToken,
      verificationExpiresAt: expiresAt,
      emailVerified: false,
      ...(signupAttribution && {
        signupChannel: signupAttribution.signupChannel,
        signupUtmSource: signupAttribution.signupUtmSource,
        signupUtmMedium: signupAttribution.signupUtmMedium,
        signupUtmCampaign: signupAttribution.signupUtmCampaign,
        signupUtmTerm: signupAttribution.signupUtmTerm,
        signupUtmContent: signupAttribution.signupUtmContent,
        signupReferrer: signupAttribution.signupReferrer,
        signupLandingPage: signupAttribution.signupLandingPage,
      }),
    },
  });

  // Create default subscription (Free tier)
  await prisma.subscription.create({
    data: {
      userId: user.id,
      tier: 'free',
      status: 'active',
    },
  });

  // Create user preferences
  await prisma.userPreference.create({
    data: {
      userId: user.id,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'registration',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: {
        email: user.email,
        countryCode: user.countryCode,
        ...attributionToAuditMetadata(signupAttribution),
      },
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      tier: 'free',
      locale: user.locale,
      emailVerified: user.emailVerified,
      displayName: null,
      avatarUrl: null,
    },
    verificationToken,
  };
}

/**
 * Verify user email
 */
export async function verifyEmail(token: string): Promise<UserResponse> {
  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    throw new Error('Invalid verification token');
  }

  if (!user.verificationExpiresAt) {
    throw new Error('Verification token has no expiration date');
  }

  if (isTokenExpired(user.verificationExpiresAt)) {
    throw new Error('Verification token has expired');
  }

  if (user.emailVerified) {
    throw new Error('Email is already verified');
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationExpiresAt: null,
    },
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    tier: 'free',
    locale: updatedUser.locale,
    emailVerified: updatedUser.emailVerified,
    displayName: null,
    avatarUrl: null,
  };
}

/**
 * Resend verification email
 * Generates a new token and sends verification email to the user
 */
export async function resendVerificationEmail(userId: string): Promise<{ email: string; verificationToken: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email is already verified');
  }

  // Generate new verification token
  const { token: newToken, expiresAt } = generateVerificationToken();

  // Update user's verification token
  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationToken: newToken,
      verificationExpiresAt: expiresAt,
    },
  });

  return {
    email: user.email,
    verificationToken: newToken,
  };
}

/**
 * Login user
 */
export async function loginUser(
  data: LoginInput,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  user: UserResponse;
  tokens: AuthTokens;
}> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if account is locked
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.accountLockedUntil.getTime() - new Date().getTime()) / 60000
    );
    throw new Error(`Account is locked. Try again in ${minutesLeft} minutes`);
  }

  // Verify password
  if (!user.passwordHash) {
    throw new Error('Invalid email or password');
  }
  const isPasswordValid = await comparePassword(data.password, user.passwordHash);

  if (!isPasswordValid) {
    // Increment failed login attempts
    const failedAttempts = user.failedLoginAttempts + 1;
    const updateData: any = {
      failedLoginAttempts: failedAttempts,
    };

    // Lock account after 5 failed attempts
    if (failedAttempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 15); // Lock for 15 minutes
      updateData.accountLockedUntil = lockUntil;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    throw new Error('Invalid email or password');
  }

  // Reset failed login attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Get user's subscription tier
  const subscription = user.subscriptions[0];
  const tier = subscription?.tier || 'free';

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    tier,
  });

  const refreshToken = generateRefreshToken({
    sub: user.id,
    email: user.email,
    tier,
  });

  // Store session in Redis
  const sessionId = uuidv4();
  const redis = getRedisClient();
  await redis.setex(
    RedisKeys.session(sessionId),
    RedisTTL.SESSION,
    JSON.stringify({
      userId: user.id,
      email: user.email,
      subscriptionTier: tier,
      locale: user.locale,
      timezone: user.timezone,
      lastActivity: new Date().toISOString(),
    })
  );

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        sessionId,
      },
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      tier,
      locale: user.locale,
      emailVerified: user.emailVerified,
      displayName: user.displayName || null,
      avatarUrl: user.avatarUrl || null,
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 1800, // 30 minutes in seconds
    },
  };
}

/**
 * Logout user
 */
export async function logoutUser(
  userId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedisClient();
  
  // Remove session from Redis
  await redis.del(RedisKeys.session(sessionId));

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'logout',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        sessionId,
      },
    },
  });
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  try {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's subscription tier
    const subscription = user.subscriptions[0];
    const tier = subscription?.tier || 'free';

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      tier,
    });

    const newRefreshToken = generateRefreshToken({
      sub: user.id,
      email: user.email,
      tier,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 1800, // 30 minutes in seconds
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Invalid or expired refresh token');
    }
    throw error;
  }
}

/**
 * Send a 6-digit password reset code to the user's email (expires in 60 seconds).
 * Always succeeds silently if the email is not registered (prevents enumeration).
 */
export async function requestPasswordResetCode(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return;
  }

  const redis = getRedisClient();
  const rateLimitKey = RedisKeys.passwordResetRateLimit(normalizedEmail);
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) {
    await redis.expire(rateLimitKey, RedisTTL.PASSWORD_RESET_RATE_LIMIT);
  }
  if (attempts > 5) {
    throw new Error('Too many reset requests. Please try again in 10 minutes.');
  }

  const code = generateSixDigitCode();
  await redis.setex(
    RedisKeys.passwordReset(normalizedEmail),
    RedisTTL.PASSWORD_RESET_CODE,
    code,
  );

  const emailResult = await sendPasswordResetCodeEmail(normalizedEmail, code);
  if (!emailResult.success) {
    throw new Error('Failed to send verification code. Please try again later.');
  }
}

/**
 * Reset password using a 6-digit email verification code (valid for 60 seconds).
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const redis = getRedisClient();
  const storedCode = await redis.get(RedisKeys.passwordReset(normalizedEmail));

  if (!storedCode || storedCode !== code) {
    throw new Error('Invalid or expired verification code');
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new Error('Invalid or expired verification code');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    },
  });

  await redis.del(RedisKeys.passwordReset(normalizedEmail));

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'password_change',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: normalizedEmail },
    },
  });
}
