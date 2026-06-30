import * as Sentry from '@sentry/node';
import { Application } from 'express';

/**
 * Initialize Sentry error tracking
 */
export function initSentry(app: Application): void {
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  const isDev = process.env.NODE_ENV !== 'production';

  const integrations = [
    // Enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // Enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
  ];

  // Enable profiling only in production (avoids Windows native binding issues in dev)
  if (!isDev) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProfilingIntegration } = require('@sentry/profiling-node');
    integrations.push(new ProfilingIntegration());
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
    // In production, adjust this value to reduce overhead
    tracesSampleRate: isDev ? 1.0 : 0.1,
    
    // Set profilesSampleRate to 1.0 to profile 100% of sampled transactions
    profilesSampleRate: isDev ? 0 : 0.1,
    
    integrations,
    
    // Filter out health check requests
    beforeSend(event, hint) {
      const url = event.request?.url;
      if (url && (url.includes('/health') || url.includes('/metrics'))) {
        return null;
      }
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        service: 'tradewise-backend',
        version: process.env.npm_package_version || 'unknown',
      },
    },
  });

  // RequestHandler creates a separate execution context using domains
  app.use(Sentry.Handlers.requestHandler());
  
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

/**
 * Sentry error handler middleware
 * Must be used after all controllers and before other error handlers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sentryErrorHandler: any = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture all errors with status code >= 500
    return true;
  },
});

/** Get Sentry request handler (for external middleware registration) */
export function getSentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/** Get Sentry tracing handler (for external middleware registration) */
export function getSentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/** Alias for error handler */
export const getSentryErrorHandler = () => sentryErrorHandler;

/**
 * Capture exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op,
  });
}

export default Sentry;
