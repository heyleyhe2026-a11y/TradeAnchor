import Redis from 'ioredis';

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis connection closed');
    });
  }

  return redisClient;
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Redis key namespaces for better organization
 */
export const RedisKeys = {
  // Session storage: session:{sessionId}
  session: (sessionId: string) => `session:${sessionId}`,
  
  // Rate limiting: ratelimit:api:{userId}:{endpoint}
  rateLimitApi: (userId: string, endpoint: string) => `ratelimit:api:${userId}:${endpoint}`,
  
  // AI rate limiting: ratelimit:ai:{userId}
  rateLimitAi: (userId: string) => `ratelimit:ai:${userId}`,
  
  // Dashboard cache: dashboard:{userId}:{filtersHash}
  dashboard: (userId: string, filtersHash: string) => `dashboard:${userId}:${filtersHash}`,
  
  // Market data cache: market:{symbol}
  market: (symbol: string) => `market:${symbol}`,
  
  // User cache: user:{userId}
  user: (userId: string) => `user:${userId}`,
  
  // Subscription cache: subscription:{userId}
  subscription: (userId: string) => `subscription:${userId}`,

  // Password reset code: pwdreset:{email}
  passwordReset: (email: string) => `pwdreset:${email.toLowerCase()}`,

  // Password reset rate limit: ratelimit:pwdreset:{email}
  passwordResetRateLimit: (email: string) => `ratelimit:pwdreset:${email.toLowerCase()}`,

  // Public landing page stats
  publicStats: () => 'public:stats',
};

/**
 * Redis TTL constants (in seconds)
 */
export const RedisTTL = {
  SESSION: 1800, // 30 minutes
  RATE_LIMIT_API: 3600, // 1 hour
  RATE_LIMIT_AI: 2592000, // 30 days
  DASHBOARD: 300, // 5 minutes
  MARKET_DATA: 60, // 1 minute
  USER_CACHE: 600, // 10 minutes
  SUBSCRIPTION_CACHE: 300, // 5 minutes
  PASSWORD_RESET_CODE: 60, // 1 minute
  PASSWORD_RESET_RATE_LIMIT: 600, // 10 minutes
  PUBLIC_STATS: 300, // 5 minutes
};

export default getRedisClient;
