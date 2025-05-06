// src/middleware/rateLimiter.ts - Separate rate limiting middleware

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Create Redis client if REDIS_URL is available
let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });
    logger.info('Redis connection established for rate limiting');
  } catch (err) {
    logger.error('Failed to connect to Redis:', err);
  }
}

// Create Redis store for rate limiting if Redis is available
let redisStore: any = null;
if (redisClient && process.env.NODE_ENV === 'production') {
  try {
    const RedisStore = require('rate-limit-redis');
    redisStore = new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
      // 1 second precision
      timeWindow: 1000,
    });
    logger.info('Redis store created for rate limiting');
  } catch (err) {
    logger.error('Failed to create Redis store:', err);
  }
}

// Standard API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Lower limit in production
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  // Use Redis store in production if available
  ...(redisStore && { store: redisStore }),
});

// More strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // Lower limit in production
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later.',
  // Use Redis store in production if available
  ...(redisStore && { store: redisStore }),
});

// Very strict rate limiter for sensitive operations
export const sensitiveOpLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // Lower limit in production
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts for this operation, please try again later.',
  // Use Redis store in production if available
  ...(redisStore && { store: redisStore }),
});

// Custom handler for rate limit exceeded
export const customRateLimitHandler = (req: Request, res: Response, next: NextFunction, options: any) => {
  logger.warn(`Rate limit exceeded: ${req.ip} - ${req.method} ${req.originalUrl}`);
  
  return res.status(options.statusCode).json({
    success: false,
    error: options.message,
    retryAfter: options.headers['Retry-After'],
  });
};