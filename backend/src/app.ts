// src/app.ts

import express from 'express';
import config from './config';
import { logger, httpLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection, handleCSRFError } from './middleware/csrfProtection';
import { setupSwagger } from './utils/swagger';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from './services/redisService';
import { initMetrics, metricsEndpoint, requestMetrics } from './middleware/metrics';

// Routes
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';

const app = express();

// Initialize metrics
if (config.monitoring.metricsEnabled) {
  initMetrics();
}

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", config.appUrl, 'https://api.openai.com', 'https://api.anthropic.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xssFilter: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS
app.use(cors(config.cors));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(httpLogger);

// Request metrics
if (config.monitoring.metricsEnabled) {
  app.use(requestMetrics);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.window,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  store: new RedisStore({
    client: redisClient,
    prefix: 'rate-limit:',
    timeWindow: 1000,
  }),
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// CSRF protection for all mutating endpoints
if (config.nodeEnv === 'production') {
  app.use('/api', csrfProtection);
  app.use(handleCSRFError);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Metrics endpoint
if (config.monitoring.metricsEnabled) {
  app.get(config.monitoring.metricsPath, metricsEndpoint);
}

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    
    // Check redis connection
    let redisStatus;
    try {
      await redisClient.ping();
      redisStatus = 'connected';
    } catch (err) {
      redisStatus = 'error';
    }
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: dbStatus === 1 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      services: {
        database: dbStatusMap[dbStatus] || 'unknown',
        redis: redisStatus,
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
    });
  } catch (error) {
    res.status(503).json({ status: 'error', error: 'Health check failed' });
  }
});

// Simple ping endpoint for load balancers
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Swagger docs
if (config.nodeEnv !== 'production') {
  setupSwagger(app);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
  });
});

// Global error handler
app.use(errorHandler);

export default app;