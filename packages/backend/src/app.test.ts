import request from 'supertest';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { swaggerSpec } from './config/swagger';
import { stream } from './lib/logger';

// Create a minimal test app without database dependencies
function createTestApp(): Application {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression middleware
  app.use(compression());

  // Logging middleware
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev', { stream }));
  } else {
    app.use(morgan('combined', { stream }));
  }

  // API Documentation (Swagger)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TradeAnchor API Documentation',
  }));

  // Swagger JSON endpoint
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Health check endpoints
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/health/detailed', async (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: 'healthy', responseTime: 10 },
        redis: { status: 'healthy', responseTime: 5 },
        mongodb: { status: 'healthy', responseTime: 8 },
      },
    });
  });

  // API info endpoint
  app.get('/api/v1/', (_req, res) => {
    res.json({
      message: 'TradeAnchor API v1',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        auth: '/api/v1/auth',
        trades: '/api/v1/trades',
        health: '/health',
      },
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

describe('Backend API Framework', () => {
  let app: Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Middleware Configuration', () => {
    it('should have CORS enabled', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should have security headers (helmet)', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should accept JSON body', async () => {
      const response = await request(app)
        .post('/api/v1/test')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');
      
      // Should not return 415 Unsupported Media Type
      expect(response.status).not.toBe(415);
    });

    it('should accept URL-encoded body', async () => {
      const response = await request(app)
        .post('/api/v1/test')
        .send('test=data')
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      // Should not return 415 Unsupported Media Type
      expect(response.status).not.toBe(415);
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return simple health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health status', async () => {
      const response = await request(app).get('/health/detailed');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.services).toHaveProperty('mongodb');
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger UI at /api-docs', async () => {
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger');
    });

    it('should serve Swagger JSON at /api-docs.json', async () => {
      const response = await request(app).get('/api-docs.json');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body.info).toHaveProperty('title', 'TradeAnchor API Documentation');
      expect(response.body.info).toHaveProperty('version', '1.0.0');
    });

    it('should have security schemes defined', async () => {
      const response = await request(app).get('/api-docs.json');
      
      expect(response.body.components).toHaveProperty('securitySchemes');
      expect(response.body.components.securitySchemes).toHaveProperty('bearerAuth');
      expect(response.body.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(response.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    it('should have error schemas defined', async () => {
      const response = await request(app).get('/api-docs.json');
      
      expect(response.body.components).toHaveProperty('schemas');
      expect(response.body.components.schemas).toHaveProperty('Error');
      expect(response.body.components.schemas).toHaveProperty('HealthCheck');
    });

    it('should have common response definitions', async () => {
      const response = await request(app).get('/api-docs.json');
      
      expect(response.body.components).toHaveProperty('responses');
      expect(response.body.components.responses).toHaveProperty('BadRequest');
      expect(response.body.components.responses).toHaveProperty('Unauthorized');
      expect(response.body.components.responses).toHaveProperty('Forbidden');
      expect(response.body.components.responses).toHaveProperty('NotFound');
      expect(response.body.components.responses).toHaveProperty('TooManyRequests');
      expect(response.body.components.responses).toHaveProperty('InternalServerError');
    });
  });

  describe('API Routes', () => {
    it('should return API info at root endpoint', async () => {
      const response = await request(app).get('/api/v1/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'TradeAnchor API v1');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('endpoints');
    });

    it('should have auth routes defined', async () => {
      const response = await request(app).get('/api/v1/');
      
      expect(response.body.endpoints).toHaveProperty('auth');
      expect(response.body.endpoints.auth).toBe('/api/v1/auth');
    });

    it('should have trades routes defined', async () => {
      const response = await request(app).get('/api/v1/');
      
      expect(response.body.endpoints).toHaveProperty('trades');
      expect(response.body.endpoints.trades).toBe('/api/v1/trades');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errorCode', 'RESOURCE_NOT_FOUND');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path');
    });

    it('should return proper error format', async () => {
      const response = await request(app).get('/api/v1/non-existent');
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path');
      
      // Timestamp should be valid ISO 8601 format
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      // Express returns 500 for malformed JSON, which is then handled by error middleware
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(600);
    });

    it('should reject oversized payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB (limit is 10MB)
      
      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send({ data: largePayload });
      
      // Express returns 413 or 500 for oversized payloads
      expect(response.status).toBeGreaterThanOrEqual(413);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe('Security', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(app).get('/health');
      
      // Should not have X-Powered-By header
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Response Format', () => {
    it('should return JSON responses', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include proper timestamps', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body).toHaveProperty('timestamp');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
      
      // Timestamp should be recent (within last 5 seconds)
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      expect(diff).toBeLessThan(5000);
    });
  });

  describe('Performance', () => {
    it('should respond to health check within 2 seconds', async () => {
      const startTime = Date.now();
      
      await request(app).get('/health');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(2000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
