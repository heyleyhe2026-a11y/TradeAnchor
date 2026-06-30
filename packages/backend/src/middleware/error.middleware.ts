import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;
  isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string,
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message: string;
  errorCode?: string;
  timestamp: string;
  path?: string;
  stack?: string;
}

/**
 * Global error handling middleware
 * Handles all errors thrown in the application
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error values
  let statusCode = 500;
  let errorCode: string | undefined;
  let message = 'Internal Server Error';
  
  // Check if it's an ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
  } else {
    // Handle other known error types
    message = err.message || message;
  }

  // Log error
  logger.error({
    message: err.message,
    statusCode,
    errorCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
    message: isDevelopment ? message : (statusCode >= 500 ? 'An unexpected error occurred' : message),
    errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Include stack trace in development
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: 'Not Found',
    message: 'The requested resource was not found',
    errorCode: 'RESOURCE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  logger.warn({
    message: 'Resource not found',
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json(errorResponse);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const handleValidationError = (message: string, errorCode = 'VALIDATION_ERROR') => {
  return new ApiError(400, message, errorCode);
};

/**
 * Authentication error handler
 */
export const handleAuthError = (message = 'Authentication failed', errorCode = 'AUTH_ERROR') => {
  return new ApiError(401, message, errorCode);
};

/**
 * Authorization error handler
 */
export const handleAuthorizationError = (message = 'Insufficient permissions', errorCode = 'AUTHORIZATION_ERROR') => {
  return new ApiError(403, message, errorCode);
};

/**
 * Not found error handler
 */
export const handleNotFoundError = (resource: string) => {
  return new ApiError(404, `${resource} not found`, 'RESOURCE_NOT_FOUND');
};

/**
 * Conflict error handler
 */
export const handleConflictError = (message: string, errorCode = 'CONFLICT_ERROR') => {
  return new ApiError(409, message, errorCode);
};

/**
 * Rate limit error handler
 */
export const handleRateLimitError = (message = 'Too many requests', errorCode = 'RATE_LIMIT_EXCEEDED') => {
  return new ApiError(429, message, errorCode);
};

/**
 * Internal server error handler
 */
export const handleInternalError = (message = 'Internal server error', errorCode = 'INTERNAL_ERROR') => {
  return new ApiError(500, message, errorCode, false);
};
