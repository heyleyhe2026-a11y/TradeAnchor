import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import logger from './logger';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'tradewise_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'tradewise_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'tradewise_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Active connections gauge
const activeConnections = new client.Gauge({
  name: 'tradewise_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

// Database query duration histogram
const databaseQueryDuration = new client.Histogram({
  name: 'tradewise_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// Database connection pool gauge
const databaseConnectionPool = new client.Gauge({
  name: 'tradewise_database_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'],
  registers: [register],
});

// Redis operation duration histogram
const redisOperationDuration = new client.Histogram({
  name: 'tradewise_redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// AI request counter
const aiRequestsTotal = new client.Counter({
  name: 'tradewise_ai_requests_total',
  help: 'Total number of AI API requests',
  labelNames: ['model', 'status'],
  registers: [register],
});

// AI request duration histogram
const aiRequestDuration = new client.Histogram({
  name: 'tradewise_ai_request_duration_seconds',
  help: 'Duration of AI API requests in seconds',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

// Business metrics

// Authentication attempts counter
const authenticationAttempts = new client.Counter({
  name: 'tradewise_authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status'],
  registers: [register],
});

// Subscription changes counter
const subscriptionChanges = new client.Counter({
  name: 'tradewise_subscription_changes_total',
  help: 'Total number of subscription changes',
  labelNames: ['from_tier', 'to_tier'],
  registers: [register],
});

// Payment transactions counter
const paymentTransactions = new client.Counter({
  name: 'tradewise_payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['method', 'status'],
  registers: [register],
});

// Trade records created counter
const tradeRecordsCreated = new client.Counter({
  name: 'tradewise_trade_records_created_total',
  help: 'Total number of trade records created',
  registers: [register],
});

// Rate limit exceeded counter
const rateLimitExceeded = new client.Counter({
  name: 'tradewise_rate_limit_exceeded_total',
  help: 'Total number of rate limit violations',
  labelNames: ['endpoint'],
  registers: [register],
});

/**
 * Middleware to track HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Increment active connections
  activeConnections.inc();

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.inc({ method, path, status });
    httpRequestDuration.observe({ method, path, status }, duration);

    // Decrement active connections
    activeConnections.dec();
  });

  next();
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
}

/**
 * Record database query duration
 */
export function recordDatabaseQuery(operation: string, model: string, duration: number): void {
  databaseQueryDuration.observe({ operation, model }, duration);
}

/**
 * Update database connection pool metrics
 */
export function updateDatabaseConnectionPool(idle: number, active: number): void {
  databaseConnectionPool.set({ state: 'idle' }, idle);
  databaseConnectionPool.set({ state: 'active' }, active);
}

/**
 * Record Redis operation duration
 */
export function recordRedisOperation(operation: string, duration: number): void {
  redisOperationDuration.observe({ operation }, duration);
}

/**
 * Record AI request
 */
export function recordAIRequest(model: string, status: 'success' | 'error', duration: number): void {
  aiRequestsTotal.inc({ model, status });
  aiRequestDuration.observe({ model }, duration);
}

/**
 * Record authentication attempt
 */
export function recordAuthenticationAttempt(type: 'login' | 'register' | 'refresh', status: 'success' | 'failure'): void {
  authenticationAttempts.inc({ type, status });
}

/**
 * Record subscription change
 */
export function recordSubscriptionChange(fromTier: string, toTier: string): void {
  subscriptionChanges.inc({ from_tier: fromTier, to_tier: toTier });
}

/**
 * Record payment transaction
 */
export function recordPaymentTransaction(method: string, status: 'success' | 'failure'): void {
  paymentTransactions.inc({ method, status });
}

/**
 * Record trade record creation
 */
export function recordTradeRecordCreated(): void {
  tradeRecordsCreated.inc();
}

/**
 * Record rate limit exceeded
 */
export function recordRateLimitExceeded(endpoint: string): void {
  rateLimitExceeded.inc({ endpoint });
}

export default {
  register,
  metricsMiddleware,
  metricsHandler,
  recordDatabaseQuery,
  updateDatabaseConnectionPool,
  recordRedisOperation,
  recordAIRequest,
  recordAuthenticationAttempt,
  recordSubscriptionChange,
  recordPaymentTransaction,
  recordTradeRecordCreated,
  recordRateLimitExceeded,
};
