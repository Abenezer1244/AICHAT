// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error handler
export class DatabaseError extends ApiError {
  constructor(message: string) {
    super(message, 500, true);
    this.name = 'DatabaseError';
  }
}

// Validation error handler
export class ValidationError extends ApiError {
  errors: Record<string, any>;
  
  constructor(message: string, errors: Record<string, any> = {}) {
    super(message, 400, true);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Auth error handler
export class AuthError extends ApiError {
  constructor(message: string) {
    super(message, 401, true);
    this.name = 'AuthError';
  }
}

// Global error handler middleware
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error(`${err.name}: ${err.message}`, { 
    path: req.path,
    method: req.method,
    stack: err.stack,
    // Additional context for debugging
    query: req.query,
    body: req.body,
    // Don't log sensitive info
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      cookie: req.headers.cookie ? '[REDACTED]' : undefined,
    }
  });

  // Default to 500 server error
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const isOperational = 'isOperational' in err ? err.isOperational : false;
  
  // Response data
  const errorResponse = {
    success: false,
    error: err.message || 'Server Error',
    ...(isOperational && 'errors' in err ? { details: err.errors } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  };
  
  // Send error response
  res.status(statusCode).json(errorResponse);
  
  // If error is not operational (i.e., unexpected), notify dev team
  if (!isOperational) {
    // In a real app, this could notify via email, Slack, etc.
    logger.error('NON-OPERATIONAL ERROR: Immediate attention required', {
      error: err,
      request: {
        path: req.path,
        method: req.method,
        ip: req.ip,
      }
    });
  }
};