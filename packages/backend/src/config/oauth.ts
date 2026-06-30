import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { getRedisClient, RedisKeys, RedisTTL } from '../lib/redis';
import { TaskService } from '../services/task.service';
import { v4 as uuidv4 } from 'uuid';
import {
  attributionToAuditMetadata,
  normalizeSignupAttribution,
  SignupAttributionInput,
} from '../utils/signup-attribution.util';

// --- Types ---

export interface OAuthProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  provider: 'google';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// --- Helper: find or create user + issue JWTs ---

async function handleOAuthUser(
  profile: OAuthProfile,
  attributionInput?: SignupAttributionInput | null,
): Promise<{ userId: string; email: string; displayName: string | null; avatarUrl: string | null; emailVerified: boolean; tokens: AuthTokens }> {
  // Try to find existing user by provider+providerId
  // NOTE: provider/providerId fields require running `prisma generate` after schema update
  const whereClause: any = {
    provider: profile.provider,
    providerId: profile.id,
  };
  let user = await prisma.user.findFirst({
    where: whereClause,
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  }) as any;

  if (!user) {
    // Check if email already exists (merge accounts)
    const existingByEmail = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingByEmail) {
      // Link this OAuth account to the existing user
      const updateData: any = {
        provider: profile.provider,
        providerId: profile.id,
        avatarUrl: profile.avatarUrl || (existingByEmail as any).avatarUrl,
        displayName: profile.displayName || (existingByEmail as any).displayName,
        emailVerified: true,
      };
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: updateData,
        include: {
          subscriptions: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }) as any;
    } else {
      // Create new user
      const signupAttribution = normalizeSignupAttribution(attributionInput);
      const createData: any = {
        email: profile.email,
        provider: profile.provider,
        providerId: profile.id,
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
        emailVerified: true,
        countryCode: 'US',
        ...(signupAttribution && {
          signupChannel: signupAttribution.signupChannel === 'direct'
            ? 'google_oauth'
            : signupAttribution.signupChannel,
          signupUtmSource: signupAttribution.signupUtmSource,
          signupUtmMedium: signupAttribution.signupUtmMedium,
          signupUtmCampaign: signupAttribution.signupUtmCampaign,
          signupUtmTerm: signupAttribution.signupUtmTerm,
          signupUtmContent: signupAttribution.signupUtmContent,
          signupReferrer: signupAttribution.signupReferrer,
          signupLandingPage: signupAttribution.signupLandingPage,
        }),
      };
      if (!signupAttribution) {
        createData.signupChannel = 'google_oauth';
      }
      user = await prisma.user.create({
        data: createData,
      });

      // Create default subscription
      await prisma.subscription.create({
        data: { userId: user.id, tier: 'free', status: 'active' },
      });

      // Create preferences
      await prisma.userPreference.create({ data: { userId: user.id } });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'registration',
          resourceType: 'user',
          resourceId: user.id,
          metadata: {
            email: profile.email,
            provider: profile.provider,
            ...attributionToAuditMetadata(signupAttribution ?? { signupChannel: 'google_oauth' }),
          },
        },
      });

      // Re-fetch with subscription
      user = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          subscriptions: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }) as any;
    }
  }

  // Update last login
  await prisma.user.update({
    where: { id: user!.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, accountLockedUntil: null },
  });

  // Generate JWTs
  const subscription = (user!.subscriptions || [])[0];
  const tier = subscription?.tier || 'free';

  const accessToken = generateAccessToken({
    sub: user!.id,
    email: user!.email,
    tier,
  });
  const refreshToken = generateRefreshToken({
    sub: user!.id,
    email: user!.email,
    tier,
  });

  // Store session in Redis
  const sessionId = uuidv4();
  const redis = getRedisClient();
  await redis.setex(
    RedisKeys.session(sessionId),
    RedisTTL.SESSION,
    JSON.stringify({
      userId: user!.id,
      email: user!.email,
      subscriptionTier: tier,
      locale: user!.locale,
      timezone: user!.timezone,
      lastActivity: new Date().toISOString(),
    })
  );

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user!.id,
      metadata: { provider: profile.provider, sessionId },
    },
  });

  // OAuth users are verified — sync verify_email task if not yet completed
  if (user!.emailVerified) {
    try {
      await TaskService.recordEvent(user!.id, 'verify_email', 1);
    } catch {
      // Non-critical
    }
  }

  return {
    userId: user!.id,
    email: user!.email,
    displayName: user!.displayName || null,
    avatarUrl: user!.avatarUrl || null,
    emailVerified: user!.emailVerified,
    tokens: { accessToken, refreshToken, expiresIn: 1800 },
  };
}

// --- Passport Serializers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
passport.serializeUser((user: any, done) => done(null, typeof user === 'string' ? user : user.id));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
passport.deserializeUser(async (id: any, done: (err: any, user?: any) => void) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// --- Google Strategy ---

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/v1/auth/google/callback`,
        scope: ['profile', 'email'],
        passReqToCallback: true,
      },
      async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
        try {
          const { decodeAttributionState } = await import('../utils/signup-attribution.util');
          const attribution = decodeAttributionState(req.query?.state as string | undefined);
          const result = await handleOAuthUser({
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName || undefined,
            avatarUrl: profile.photos?.[0]?.value || undefined,
            provider: 'google',
          }, attribution);
          done(null, result);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

export { passport, handleOAuthUser };
