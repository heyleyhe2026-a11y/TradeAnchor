import { checkDatabaseHealth } from './db-health';
import { checkRedisHealth } from './redis';
import { checkMongoHealth } from './mongodb';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    postgres: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    mongodb: {
      status: 'up' | 'down';
      responseTime?: number;
    };
  };
}

/**
 * Perform comprehensive health check on all services
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      postgres: { status: 'down' },
      redis: { status: 'down' },
      mongodb: { status: 'down' },
    },
  };

  // Check PostgreSQL
  try {
    const startTime = Date.now();
    const isHealthy = await checkDatabaseHealth();
    const responseTime = Date.now() - startTime;
    
    result.services.postgres = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
    };
  } catch (error) {
    console.error('PostgreSQL health check error:', error);
    result.services.postgres.status = 'down';
  }

  // Check Redis
  try {
    const startTime = Date.now();
    const isHealthy = await checkRedisHealth();
    const responseTime = Date.now() - startTime;
    
    result.services.redis = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
    };
  } catch (error) {
    console.error('Redis health check error:', error);
    result.services.redis.status = 'down';
  }

  // Check MongoDB
  try {
    const startTime = Date.now();
    const isHealthy = await checkMongoHealth();
    const responseTime = Date.now() - startTime;
    
    result.services.mongodb = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
    };
  } catch (error) {
    console.error('MongoDB health check error:', error);
    result.services.mongodb.status = 'down';
  }

  // Determine overall status
  const allUp = Object.values(result.services).every((service) => service.status === 'up');
  const allDown = Object.values(result.services).every((service) => service.status === 'down');

  if (allUp) {
    result.status = 'healthy';
  } else if (allDown) {
    result.status = 'unhealthy';
  } else {
    result.status = 'degraded';
  }

  return result;
}

/**
 * Simple health check (just returns 200 if server is running)
 */
export function simpleHealthCheck(): { status: string; timestamp: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness check - determines if the service is ready to accept traffic
 */
export async function performReadinessCheck(): Promise<{
  ready: boolean;
  checks: {
    database: boolean;
    redis: boolean;
    mongodb: boolean;
  };
}> {
  const checks = {
    database: false,
    redis: false,
    mongodb: false,
  };

  try {
    checks.database = await checkDatabaseHealth();
  } catch (error) {
    console.error('Database readiness check failed:', error);
  }

  try {
    checks.redis = await checkRedisHealth();
  } catch (error) {
    console.error('Redis readiness check failed:', error);
  }

  try {
    checks.mongodb = await checkMongoHealth();
  } catch (error) {
    console.error('MongoDB readiness check failed:', error);
  }

  return {
    ready: checks.database && checks.redis && checks.mongodb,
    checks,
  };
}

/**
 * Liveness check - determines if the service is alive
 */
export function performLivenessCheck(): {
  alive: boolean;
  uptime: number;
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
  };
} {
  const memUsage = process.memoryUsage();
  
  return {
    alive: true,
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    },
  };
}
