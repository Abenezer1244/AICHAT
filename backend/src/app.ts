// src/app.ts - Updated main Express application with metrics integration

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import chatRoutes from './routes/chatRoutes';
import authRoutes from './routes/authRoutes';
import { initMetrics, metricsEndpoint, requestMetrics } from './middleware/metrics';

// Initialize express application
const app: Application = express();

// Initialize metrics
initMetrics();

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));  // Sets various HTTP headers for security
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));    // Enable CORS for all routes
app.use(express.json({ limit: '1mb' })); // Parse JSON request bodies with size limit

// Request metrics middleware - Add before route handlers
app.use(requestMetrics);

// Rate limiting for API protection - Redis store for distributed rate limiting
const redisClient = require('redis').createClient(process.env.REDIS_URL || 'redis://localhost:6379');
const RedisStore = require('rate-limit-redis');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  // Use Redis store for distributed rate limiting when in production
  ...(process.env.NODE_ENV === 'production' && {
    store: new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
      // 1 second precision for expiry time in Redis
      timeWindow: 1000,
    }),
  }),
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// More aggressive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 login attempts per hour
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store for distributed rate limiting when in production
  ...(process.env.NODE_ENV === 'production' && {
    store: new RedisStore({
      client: redisClient,
      prefix: 'auth-rate-limit:',
      timeWindow: 1000,
    }),
  }),
});

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Skip logging health check endpoints to reduce noise
  if (!req.path.includes('/health') && !req.path.includes('/metrics')) {
    logger.info(`${req.method} ${req.path} ${req.ip}`);
  }
  next();
});

// Routes with specific rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Metrics endpoint - keep it separate from API routes to avoid rate limiting
app.get('/metrics', metricsEndpoint);

// Detailed health check endpoint for monitoring
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check redis connection
    const redisStatus = await new Promise((resolve) => {
      redisClient.ping((err: Error) => {
        resolve(err ? 'error' : 'connected');
      });
    });
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
    });
  } catch (error) {
    // Simple response if detailed checks fail
    res.status(200).json({ status: 'ok' });
  }
});

// Simple health check for load balancers
app.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('pong');
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
  });
});

// Global error handler
app.use(errorHandler);

export default app;