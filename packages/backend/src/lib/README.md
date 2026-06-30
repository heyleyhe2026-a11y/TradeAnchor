# Database and Cache Configuration

This directory contains the database and cache client utilities for the TradeWise platform.

## Overview

The platform uses three data stores:
- **PostgreSQL**: Primary relational database for structured data (users, trades, subscriptions, etc.)
- **Redis**: In-memory cache for sessions, rate limiting, and frequently accessed data
- **MongoDB**: Document store for AI reports and follow-up questions

## Files

### `prisma.ts`
PostgreSQL client using Prisma ORM.

**Usage:**
```typescript
import { prisma } from './lib/prisma';

// Query users
const users = await prisma.user.findMany();

// Create a trade
const trade = await prisma.trade.create({
  data: {
    userId: 'user-123',
    tradingSymbol: 'AAPL',
    positionDirection: 'long',
    entryPrice: 150.25,
    exitPrice: 155.50,
    quantity: 100,
    entryTimestamp: new Date(),
    exitTimestamp: new Date(),
  },
});
```

### `redis.ts`
Redis client for caching and session management.

**Features:**
- Session storage (30 minutes TTL)
- API rate limiting (1 hour TTL)
- AI rate limiting (30 days TTL)
- Dashboard caching (5 minutes TTL)
- Market data caching (1 minute TTL)
- User and subscription caching

**Usage:**
```typescript
import { getRedisClient, RedisKeys, RedisTTL } from './lib/redis';

const redis = getRedisClient();

// Store session
const sessionData = {
  userId: 'user-123',
  email: 'user@example.com',
  subscriptionTier: 'pro',
  locale: 'en',
  timezone: 'UTC',
  lastActivity: Date.now(),
};
await redis.setex(
  RedisKeys.session('session-id'),
  RedisTTL.SESSION,
  JSON.stringify(sessionData)
);

// Get session
const session = await redis.get(RedisKeys.session('session-id'));
const data = JSON.parse(session);

// Rate limiting
await redis.incr(RedisKeys.rateLimitApi('user-123', '/api/v1/trades'));
await redis.expire(RedisKeys.rateLimitApi('user-123', '/api/v1/trades'), RedisTTL.RATE_LIMIT_API);

// Check rate limit
const count = parseInt(await redis.get(RedisKeys.rateLimitApi('user-123', '/api/v1/trades')) || '0');
if (count > 1000) {
  throw new Error('Rate limit exceeded');
}
```

**Key Namespaces:**
- `session:{sessionId}` - User sessions
- `ratelimit:api:{userId}:{endpoint}` - API rate limits
- `ratelimit:ai:{userId}` - AI follow-up question rate limits
- `dashboard:{userId}:{filtersHash}` - Dashboard cache
- `market:{symbol}` - Market data cache
- `user:{userId}` - User data cache
- `subscription:{userId}` - Subscription cache

**TTL Constants:**
- `SESSION`: 1800 seconds (30 minutes)
- `RATE_LIMIT_API`: 3600 seconds (1 hour)
- `RATE_LIMIT_AI`: 2592000 seconds (30 days)
- `DASHBOARD`: 300 seconds (5 minutes)
- `MARKET_DATA`: 60 seconds (1 minute)
- `USER_CACHE`: 600 seconds (10 minutes)
- `SUBSCRIPTION_CACHE`: 300 seconds (5 minutes)

### `mongodb.ts`
MongoDB client for AI reports and questions.

**Collections:**
- `ai_reports` - AI-generated trading analysis reports
- `ai_questions` - AI follow-up questions and answers

**Usage:**
```typescript
import { getCollection, MongoCollections, AIReportDocument } from './lib/mongodb';

// Insert AI report
const reportsCollection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
await reportsCollection.insertOne({
  reportId: 'report-123',
  userId: 'user-123',
  batchIds: ['batch-1', 'batch-2'],
  locale: 'en',
  aiModel: 'gpt-4',
  generatedAt: new Date(),
  content: {
    summary: 'Your trading shows strong performance...',
    tradingPatterns: [...],
    strengths: [...],
    weaknesses: [...],
    improvementSuggestions: [...],
    statistics: {...},
  },
  metadata: {
    generationTimeMs: 25000,
    tokensUsed: 3500,
    dataPointsAnalyzed: 45,
  },
});

// Find reports by user
const reports = await reportsCollection.find({ userId: 'user-123' }).toArray();

// Find specific report
const report = await reportsCollection.findOne({ reportId: 'report-123' });
```

**Indexes:**
- `ai_reports`:
  - `reportId` (unique)
  - `userId`
  - `generatedAt` (descending)
  - `content.statistics.winRate`
- `ai_questions`:
  - `questionId` (unique)
  - `userId`
  - `reportId`
  - `askedAt` (descending)

### `health-check.ts`
Comprehensive health check for all services.

**Usage:**
```typescript
import { performHealthCheck, simpleHealthCheck } from './lib/health-check';

// Simple health check (just returns 200)
const simple = simpleHealthCheck();
// { status: 'ok', timestamp: '2024-01-15T10:00:00.000Z' }

// Comprehensive health check
const health = await performHealthCheck();
// {
//   status: 'healthy',
//   timestamp: '2024-01-15T10:00:00.000Z',
//   services: {
//     postgres: { status: 'up', responseTime: 15 },
//     redis: { status: 'up', responseTime: 5 },
//     mongodb: { status: 'up', responseTime: 20 }
//   }
// }
```

**Health Status:**
- `healthy` - All services are up
- `degraded` - Some services are down
- `unhealthy` - All services are down

### `db-health.ts`
PostgreSQL health check utilities.

**Usage:**
```typescript
import { checkDatabaseHealth, connectDatabase, disconnectDatabase } from './lib/db-health';

// Connect to database
await connectDatabase();

// Check health
const isHealthy = await checkDatabaseHealth();

// Disconnect
await disconnectDatabase();
```

## Environment Variables

Configure the following environment variables in `.env`:

```env
# PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradewise?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MongoDB
MONGODB_URL="mongodb://localhost:27017/tradewise"
```

## Docker Setup

Start all services using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- MongoDB on port 27017

## Testing

Run tests for database and cache utilities:

```bash
# Run all tests
npm test

# Run specific test file
npm test redis.test.ts
npm test mongodb.test.ts
npm test health-check.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Connection Management

### Initialization
All connections are initialized in `src/index.ts`:

```typescript
// Connect to PostgreSQL
await connectDatabase();

// Connect to Redis
getRedisClient();

// Connect to MongoDB and initialize indexes
await getMongoClient();
await initializeMongoIndexes();
```

### Graceful Shutdown
The application handles graceful shutdown for all connections:

```typescript
// Disconnect from all services
await disconnectDatabase();
await disconnectRedis();
await disconnectMongo();
```

## Best Practices

### Redis
1. **Always set TTL** - Prevent memory leaks by setting expiration on all keys
2. **Use key namespaces** - Use `RedisKeys` helper for consistent naming
3. **Handle disconnections** - Redis client automatically reconnects
4. **Cache invalidation** - Clear cache when data changes

### MongoDB
1. **Use indexes** - Ensure queries use indexes for performance
2. **Validate documents** - Use TypeScript interfaces for type safety
3. **Handle errors** - Wrap operations in try-catch blocks
4. **Connection pooling** - Reuse connections with connection pool

### PostgreSQL
1. **Use transactions** - For operations that modify multiple tables
2. **Optimize queries** - Use Prisma's query optimization features
3. **Handle migrations** - Use Prisma migrations for schema changes
4. **Connection pooling** - Configure connection pool size based on load

## Performance Considerations

### Redis
- **Memory usage**: Monitor Redis memory usage and set `maxmemory` policy
- **Eviction policy**: Use `allkeys-lru` for cache eviction
- **Persistence**: Configure RDB or AOF based on durability requirements

### MongoDB
- **Index usage**: Use `explain()` to verify index usage
- **Document size**: Keep documents under 16MB limit
- **Sharding**: Consider sharding for large datasets

### PostgreSQL
- **Query optimization**: Use `EXPLAIN ANALYZE` to optimize queries
- **Indexes**: Create indexes on frequently queried columns
- **Connection pooling**: Configure pool size based on concurrent users

## Monitoring

### Health Checks
- Simple health check: `GET /health`
- Detailed health check: `GET /health/detailed`

### Metrics
Monitor the following metrics:
- Connection pool size
- Query response times
- Cache hit/miss ratio
- Error rates
- Memory usage

## Troubleshooting

### Redis Connection Issues
```typescript
// Check Redis connection
const redis = getRedisClient();
const result = await redis.ping();
console.log(result); // Should print 'PONG'
```

### MongoDB Connection Issues
```typescript
// Check MongoDB connection
const isHealthy = await checkMongoHealth();
console.log(isHealthy); // Should be true
```

### PostgreSQL Connection Issues
```typescript
// Check PostgreSQL connection
const isHealthy = await checkDatabaseHealth();
console.log(isHealthy); // Should be true
```

## Security

### Redis
- Use password authentication in production
- Enable TLS for encrypted connections
- Restrict network access with firewall rules

### MongoDB
- Enable authentication and authorization
- Use TLS for encrypted connections
- Implement role-based access control

### PostgreSQL
- Use strong passwords
- Enable SSL/TLS connections
- Implement row-level security where needed
- Regular security updates

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Redis Documentation](https://redis.io/documentation)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
