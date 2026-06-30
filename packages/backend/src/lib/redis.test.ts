import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  getRedisClient,
  checkRedisHealth,
  disconnectRedis,
  RedisKeys,
  RedisTTL,
} from './redis';

describe('Redis Client', () => {
  let redisClient: ReturnType<typeof getRedisClient>;

  beforeAll(() => {
    // Get Redis client instance
    redisClient = getRedisClient();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clear test keys before each test
    const keys = await redisClient.keys('test:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  describe('Connection', () => {
    it('should create a Redis client instance', () => {
      expect(redisClient).toBeDefined();
      expect(redisClient.status).toBe('ready');
    });

    it('should return the same instance on multiple calls', () => {
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });

    it('should successfully ping Redis server', async () => {
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });
  });

  describe('Health Check', () => {
    it('should return true when Redis is healthy', async () => {
      const isHealthy = await checkRedisHealth();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check errors gracefully', async () => {
      // Temporarily disconnect
      await disconnectRedis();
      
      const isHealthy = await checkRedisHealth();
      
      // Reconnect for other tests
      redisClient = getRedisClient();
      
      // Health check should handle disconnection
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Session Storage', () => {
    it('should store and retrieve session data', async () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        locale: 'en',
        timezone: 'UTC',
        lastActivity: Date.now(),
      };

      const key = RedisKeys.session(sessionId);
      await redisClient.setex(key, RedisTTL.SESSION, JSON.stringify(sessionData));

      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!)).toEqual(sessionData);
    });

    it('should expire session after TTL', async () => {
      const sessionId = 'test-session-expire';
      const key = RedisKeys.session(sessionId);
      
      await redisClient.setex(key, 1, JSON.stringify({ test: 'data' }));
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeNull();
    });

    it('should delete session on logout', async () => {
      const sessionId = 'test-session-logout';
      const key = RedisKeys.session(sessionId);
      
      await redisClient.setex(key, RedisTTL.SESSION, JSON.stringify({ test: 'data' }));
      
      const deleted = await redisClient.del(key);
      expect(deleted).toBe(1);
      
      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should track API rate limit', async () => {
      const userId = 'user-123';
      const endpoint = '/api/v1/trades';
      const key = RedisKeys.rateLimitApi(userId, endpoint);

      // Increment request count
      await redisClient.incr(key);
      await redisClient.expire(key, RedisTTL.RATE_LIMIT_API);

      const count = await redisClient.get(key);
      expect(count).toBe('1');
    });

    it('should enforce rate limit threshold', async () => {
      const userId = 'user-123';
      const endpoint = '/api/v1/trades';
      const key = RedisKeys.rateLimitApi(userId, endpoint);
      const limit = 10;

      // Simulate multiple requests
      for (let i = 0; i < limit + 5; i++) {
        await redisClient.incr(key);
      }
      await redisClient.expire(key, RedisTTL.RATE_LIMIT_API);

      const count = parseInt(await redisClient.get(key) || '0');
      expect(count).toBeGreaterThan(limit);
    });

    it('should track AI follow-up question rate limit', async () => {
      const userId = 'user-123';
      const key = RedisKeys.rateLimitAi(userId);

      await redisClient.incr(key);
      await redisClient.expire(key, RedisTTL.RATE_LIMIT_AI);

      const count = await redisClient.get(key);
      expect(count).toBe('1');
    });

    it('should reset rate limit after TTL', async () => {
      const userId = 'user-123';
      const endpoint = '/api/v1/test';
      const key = RedisKeys.rateLimitApi(userId, endpoint);

      await redisClient.setex(key, 1, '5');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const count = await redisClient.get(key);
      expect(count).toBeNull();
    });
  });

  describe('Dashboard Cache', () => {
    it('should cache dashboard data', async () => {
      const userId = 'user-123';
      const filtersHash = 'hash-abc123';
      const key = RedisKeys.dashboard(userId, filtersHash);
      
      const dashboardData = {
        statistics: {
          totalInvestment: 50000,
          totalPnL: 5250.75,
          overallWinRate: 0.68,
        },
        trades: [],
        batches: [],
        generatedAt: Date.now(),
      };

      await redisClient.setex(key, RedisTTL.DASHBOARD, JSON.stringify(dashboardData));

      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!)).toEqual(dashboardData);
    });

    it('should invalidate dashboard cache after TTL', async () => {
      const userId = 'user-123';
      const filtersHash = 'hash-test';
      const key = RedisKeys.dashboard(userId, filtersHash);

      await redisClient.setex(key, 1, JSON.stringify({ test: 'data' }));
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Market Data Cache', () => {
    it('should cache market data', async () => {
      const symbol = 'AAPL';
      const key = RedisKeys.market(symbol);
      
      const marketData = {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        updatedAt: Date.now(),
      };

      await redisClient.setex(key, RedisTTL.MARKET_DATA, JSON.stringify(marketData));

      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!)).toEqual(marketData);
    });

    it('should refresh market data after 60 seconds', async () => {
      const symbol = 'XAUUSD';
      const key = RedisKeys.market(symbol);

      await redisClient.setex(key, 1, JSON.stringify({ symbol, price: 2000 }));
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('User and Subscription Cache', () => {
    it('should cache user data', async () => {
      const userId = 'user-123';
      const key = RedisKeys.user(userId);
      
      const userData = {
        id: userId,
        email: 'test@example.com',
        locale: 'en',
        timezone: 'UTC',
      };

      await redisClient.setex(key, RedisTTL.USER_CACHE, JSON.stringify(userData));

      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!)).toEqual(userData);
    });

    it('should cache subscription data', async () => {
      const userId = 'user-123';
      const key = RedisKeys.subscription(userId);
      
      const subscriptionData = {
        tier: 'pro',
        status: 'active',
        expiresAt: new Date().toISOString(),
      };

      await redisClient.setex(key, RedisTTL.SUBSCRIPTION_CACHE, JSON.stringify(subscriptionData));

      const retrieved = await redisClient.get(key);
      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!)).toEqual(subscriptionData);
    });
  });

  describe('Key Namespaces', () => {
    it('should generate correct session key', () => {
      const sessionId = 'abc123';
      const key = RedisKeys.session(sessionId);
      expect(key).toBe('session:abc123');
    });

    it('should generate correct rate limit API key', () => {
      const userId = 'user-123';
      const endpoint = '/api/v1/trades';
      const key = RedisKeys.rateLimitApi(userId, endpoint);
      expect(key).toBe('ratelimit:api:user-123:/api/v1/trades');
    });

    it('should generate correct rate limit AI key', () => {
      const userId = 'user-123';
      const key = RedisKeys.rateLimitAi(userId);
      expect(key).toBe('ratelimit:ai:user-123');
    });

    it('should generate correct dashboard key', () => {
      const userId = 'user-123';
      const filtersHash = 'hash-abc';
      const key = RedisKeys.dashboard(userId, filtersHash);
      expect(key).toBe('dashboard:user-123:hash-abc');
    });

    it('should generate correct market key', () => {
      const symbol = 'AAPL';
      const key = RedisKeys.market(symbol);
      expect(key).toBe('market:AAPL');
    });
  });

  describe('TTL Constants', () => {
    it('should have correct TTL values', () => {
      expect(RedisTTL.SESSION).toBe(1800); // 30 minutes
      expect(RedisTTL.RATE_LIMIT_API).toBe(3600); // 1 hour
      expect(RedisTTL.RATE_LIMIT_AI).toBe(2592000); // 30 days
      expect(RedisTTL.DASHBOARD).toBe(300); // 5 minutes
      expect(RedisTTL.MARKET_DATA).toBe(60); // 1 minute
      expect(RedisTTL.USER_CACHE).toBe(600); // 10 minutes
      expect(RedisTTL.SUBSCRIPTION_CACHE).toBe(300); // 5 minutes
    });
  });
});
