import express, { Application, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { performHealthCheck, simpleHealthCheck } from './lib/health-check';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { swaggerSpec } from './config/swagger';
import logger, { stream } from './lib/logger';
import apiRoutes from './routes';
import { passport } from './config/oauth';
import {
  initSentry,
  getSentryRequestHandler,
  getSentryTracingHandler,
  getSentryErrorHandler,
} from './lib/sentry';
import { metricsMiddleware, metricsHandler } from './lib/metrics';
import { restrictInternalAccess } from './middleware/internal-only.middleware';
import { creemController } from './controllers/creem.controller';

const isProduction = process.env.NODE_ENV === 'production';

// Extend Express types: Passport's User interface is empty by default; add our fields
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      tier: string;
    }
    interface Request {
      sessionId?: string;
    }
  }
}

// Create Express application
const app: Application = express();

// Initialize Sentry (must be first)
initSentry(app);

// Trust proxy (for deployment behind load balancer)
app.set('trust proxy', 1);

// Sentry request handler (must be first middleware)
app.use(getSentryRequestHandler());

// Sentry tracing handler
app.use(getSentryTracingHandler());

// Metrics middleware (track all requests)
app.use(metricsMiddleware);

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

// Creem webhook — raw body required for HMAC signature verification
app.post(
  '/api/v1/webhooks/creem',
  express.raw({ type: 'application/json' }),
  creemController.handleWebhook,
);

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

// API Documentation (Swagger) — development/staging only
if (!isProduction) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TradeAnchor API Documentation',
  }));

  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Simple health check
 *     description: Returns basic health status of the API server
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
app.get('/health', (_req: Request, res: Response) => {
  const health = simpleHealthCheck();
  res.status(200).json(health);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Returns readiness status for Kubernetes readiness probe
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is ready
 *       503:
 *         description: Server is not ready
 */
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const health = await performHealthCheck();
    if (health.status === 'healthy') {
      res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status including database connections
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Health check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const health = await performHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Returns Prometheus metrics for monitoring
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
if (isProduction) {
  app.get('/metrics', restrictInternalAccess, metricsHandler);
} else {
  app.get('/metrics', metricsHandler);
}

// Initialize Passport for OAuth
app.use(passport.initialize());

// API routes
app.use('/api/v1', apiRoutes);

// Serve uploaded files (images, attachments)
const uploadsDir = path.join(process.cwd(), 'uploads');
// Ensure uploads directory exists at runtime (Docker volume mount may be empty)
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const attachmentsDir = path.join(uploadsDir, 'attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 404 handler
app.use(notFoundHandler);

// Sentry error handler (must be before other error handlers)
app.use(getSentryErrorHandler());

// Global error handler
app.use(errorHandler);

export default app;
