import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { performHealthCheck, simpleHealthCheck } from './health-check';
import { getRedisClient, disconnectRedis } from './redis';
import { getMongoClient, disconnectMongo, initializeMongoIndexes } from './mongodb';
import { connectDatabase, disconnectDatabase } from './db-health';

describe('Health Check', () => {
  beforeAll(async () => {
    // Connect to all services
    await connectDatabase();
    getRedisClient();
    await getMongoClient();
    await initializeMongoIndexes();
  });

  afterAll(async () => {
    // Disconnect from all services
    await disconnectDatabase();
    await disconnectRedis();
    await disconnectMongo();
  });

  describe('Simple Health Check', () => {
    it('should return ok status', () => {
      const result = simpleHealthCheck();
      
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should return current timestamp', () => {
      const before = new Date();
      const result = simpleHealthCheck();
      const after = new Date();
      
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Comprehensive Health Check', () => {
    it('should check all services', async () => {
      const result = await performHealthCheck();
      
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.services.postgres).toBeDefined();
      expect(result.services.redis).toBeDefined();
      expect(result.services.mongodb).toBeDefined();
    });

    it('should return healthy status when all services are up', async () => {
      const result = await performHealthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.services.postgres.status).toBe('up');
      expect(result.services.redis.status).toBe('up');
      expect(result.services.mongodb.status).toBe('up');
    });

    it('should include response times for all services', async () => {
      const result = await performHealthCheck();
      
      expect(result.services.postgres.responseTime).toBeDefined();
      expect(result.services.postgres.responseTime).toBeGreaterThan(0);
      
      expect(result.services.redis.responseTime).toBeDefined();
      expect(result.services.redis.responseTime).toBeGreaterThan(0);
      
      expect(result.services.mongodb.responseTime).toBeDefined();
      expect(result.services.mongodb.responseTime).toBeGreaterThan(0);
    });

    it('should have reasonable response times', async () => {
      const result = await performHealthCheck();
      
      // Response times should be under 1 second for healthy services
      expect(result.services.postgres.responseTime).toBeLessThan(1000);
      expect(result.services.redis.responseTime).toBeLessThan(1000);
      expect(result.services.mongodb.responseTime).toBeLessThan(1000);
    });

    it('should return degraded status when some services are down', async () => {
      // Disconnect Redis temporarily
      await disconnectRedis();
      
      const result = await performHealthCheck();
      
      // Reconnect Redis for other tests
      getRedisClient();
      
      expect(['degraded', 'unhealthy']).toContain(result.status);
    });

    it('should handle service failures gracefully', async () => {
      // Disconnect all services temporarily
      await disconnectDatabase();
      await disconnectRedis();
      await disconnectMongo();
      
      const result = await performHealthCheck();
      
      // Reconnect for other tests
      await connectDatabase();
      getRedisClient();
      await getMongoClient();
      
      expect(result).toBeDefined();
      expect(result.status).toBe('unhealthy');
      expect(result.services.postgres.status).toBe('down');
      expect(result.services.redis.status).toBe('down');
      expect(result.services.mongodb.status).toBe('down');
    });

    it('should return valid ISO timestamp', async () => {
      const result = await performHealthCheck();
      
      const timestamp = new Date(result.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });

  describe('Health Status Logic', () => {
    it('should determine overall status correctly', async () => {
      const result = await performHealthCheck();
      
      const allUp = Object.values(result.services).every(
        (service) => service.status === 'up'
      );
      const allDown = Object.values(result.services).every(
        (service) => service.status === 'down'
      );
      
      if (allUp) {
        expect(result.status).toBe('healthy');
      } else if (allDown) {
        expect(result.status).toBe('unhealthy');
      } else {
        expect(result.status).toBe('degraded');
      }
    });
  });

  describe('Performance', () => {
    it('should complete health check within 5 seconds', async () => {
      const start = Date.now();
      await performHealthCheck();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000);
    });

    it('should complete simple health check instantly', () => {
      const start = Date.now();
      simpleHealthCheck();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
    });
  });
});
