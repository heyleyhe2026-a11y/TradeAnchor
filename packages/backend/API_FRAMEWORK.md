# TradeWise Backend API Framework

## Overview

The TradeWise backend API is built with Express.js and TypeScript, featuring comprehensive middleware, logging, error handling, and API documentation.

## Technology Stack

- **Framework**: Express.js 4.x
- **Language**: TypeScript
- **Logging**: Winston
- **API Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet
- **Compression**: compression
- **CORS**: cors

## Architecture

### Middleware Stack

The application uses the following middleware in order:

1. **Trust Proxy**: Configured for deployment behind load balancers
2. **Helmet**: Security headers and CSP configuration
3. **CORS**: Cross-origin resource sharing with configurable origins
4. **Body Parser**: JSON and URL-encoded body parsing (10MB limit)
5. **Compression**: Response compression for better performance
6. **Morgan + Winston**: HTTP request logging with Winston integration
7. **Routes**: API routes mounted at `/api/v1`
8. **404 Handler**: Custom not found handler
9. **Error Handler**: Global error handling middleware

### Logging System

Winston is configured with multiple transports:

- **Console**: Colorized output in development, JSON in production
- **Error Log**: `logs/error.log` - Error level and above
- **Combined Log**: `logs/combined.log` - All log levels

Log files are automatically rotated (5MB max, 5 files retained).

#### Log Levels

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `http`: HTTP request logs
- `debug`: Debug messages (development only)

#### Usage Example

```typescript
import logger from './lib/logger';

logger.info('User logged in', { userId: '123' });
logger.error('Database connection failed', { error: err.message });
logger.debug('Processing request', { data });
```

### Error Handling

The application uses a centralized error handling system with custom error classes:

#### ApiError Class

```typescript
import { ApiError } from './middleware/error.middleware';

// Throw a custom error
throw new ApiError(400, 'Invalid input', 'VALIDATION_ERROR');
```

#### Error Helper Functions

```typescript
import {
  handleValidationError,
  handleAuthError,
  handleAuthorizationError,
  handleNotFoundError,
  handleConflictError,
  handleRateLimitError,
  handleInternalError,
} from './middleware/error.middleware';

// Usage in route handlers
if (!user) {
  throw handleNotFoundError('User');
}

if (existingEmail) {
  throw handleConflictError('Email already exists');
}
```

#### Async Handler Wrapper

Use the `asyncHandler` wrapper to automatically catch errors in async route handlers:

```typescript
import { asyncHandler } from './middleware/error.middleware';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw handleNotFoundError('User');
  }
  res.json(user);
}));
```

### API Documentation (Swagger)

API documentation is automatically generated using Swagger/OpenAPI 3.0.

#### Access Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/api-docs.json

#### Adding Documentation to Routes

Use JSDoc comments with Swagger annotations:

```typescript
/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a single user by their ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/users/:id', asyncHandler(async (req, res) => {
  // Implementation
}));
```

#### Common Response References

The following response types are pre-configured:

- `#/components/responses/BadRequest` - 400
- `#/components/responses/Unauthorized` - 401
- `#/components/responses/Forbidden` - 403
- `#/components/responses/NotFound` - 404
- `#/components/responses/Conflict` - 409
- `#/components/responses/TooManyRequests` - 429
- `#/components/responses/InternalServerError` - 500

#### Security Scheme

JWT Bearer authentication is configured:

```typescript
/**
 * @swagger
 * /api/v1/protected-route:
 *   get:
 *     summary: Protected endpoint
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
```

To disable authentication for a specific endpoint:

```typescript
/**
 * @swagger
 * /api/v1/public-route:
 *   get:
 *     summary: Public endpoint
 *     security: []
 *     responses:
 *       200:
 *         description: Success
 */
```

## Health Checks

Two health check endpoints are available:

### Simple Health Check

**Endpoint**: `GET /health`

Returns basic server status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Detailed Health Check

**Endpoint**: `GET /health/detailed`

Returns detailed status including database connections:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "mongodb": {
      "status": "healthy",
      "responseTime": 3
    }
  }
}
```

## Environment Variables

Required environment variables:

```env
# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tradewise

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB
MONGODB_URI=mongodb://localhost:27017/tradewise

# API
API_BASE_URL=http://localhost:3000
```

## Security Features

### Helmet Configuration

- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- X-XSS-Protection

### CORS Configuration

- Configurable allowed origins
- Credentials support
- Preflight request handling

### Request Size Limits

- JSON body: 10MB max
- URL-encoded body: 10MB max

## Performance Features

### Compression

All responses are automatically compressed using gzip/deflate.

### Response Time Logging

HTTP request duration is logged for performance monitoring.

## Development

### Running the Server

```bash
# Development mode with hot reload
pnpm dev

# Production build
pnpm build
pnpm start
```

### Testing

```bash
# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Production Considerations

1. **Environment Variables**: Ensure all required environment variables are set
2. **Log Rotation**: Configure external log rotation if needed
3. **Error Tracking**: Integrate with Sentry or similar service
4. **Monitoring**: Set up Prometheus metrics collection
5. **Rate Limiting**: Implement rate limiting middleware
6. **API Versioning**: All routes are versioned under `/api/v1`

## Next Steps

- [ ] Implement rate limiting middleware
- [ ] Add request ID tracking
- [ ] Integrate with APM (Application Performance Monitoring)
- [ ] Add metrics endpoint for Prometheus
- [ ] Implement API key authentication for external integrations
- [ ] Add request validation middleware
- [ ] Implement caching strategies
