import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt.util';
import { getRedisClient, RedisKeys } from '../lib/redis';
import { prisma } from '../lib/prisma';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authorization token provided',
      });
      return;
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid authorization format. Use: Bearer <token>',
      });
      return;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    // Verify JWT token
    let payload: JWTPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Check if user still exists in database
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
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    // Check if user's email is verified (optional, can be enforced per route)
    // if (!user.emailVerified) {
    //   res.status(403).json({
    //     success: false,
    //     error: 'Forbidden',
    //     message: 'Email not verified',
    //   });
    //   return;
    // }

    // Get user's current subscription tier
    const subscription = user.subscriptions[0];
    const tier = subscription?.tier || 'free';

    // Verify session exists in Redis (optional - don't fail auth if Redis is down)
    let sessionId: string | undefined;
    try {
      const redis = getRedisClient();
      const sessionKeys = await redis.keys(RedisKeys.session('*'));
      
      for (const key of sessionKeys) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.userId === user.id) {
            sessionId = key.split(':')[1];
            
            // Update last activity
            session.lastActivity = new Date().toISOString();
            await redis.setex(key, 1800, JSON.stringify(session)); // Reset TTL
            break;
          }
        }
      }
    } catch (redisErr) {
      // Redis unavailable - continue without session check
      console.warn('Redis session check skipped:', redisErr instanceof Error ? redisErr.message : 'unknown error');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      tier,
    };

    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional Authentication Middleware
 * Attaches user info if token is provided, but doesn't require it
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      next();
      return;
    }

    try {
      const payload = verifyAccessToken(token);

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

      if (user) {
        const subscription = user.subscriptions[0];
        const tier = subscription?.tier || 'free';

        req.user = {
          id: user.id,
          email: user.email,
          tier,
        };
      }
    } catch (error) {
      // Invalid token, but continue without authentication
      console.log('Optional auth failed:', error);
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
}

/**
 * Require Email Verification Middleware
 * Must be used after authenticate middleware
 */
export async function requireEmailVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Email verification required',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Email verification check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Verification check failed',
    });
  }
}
