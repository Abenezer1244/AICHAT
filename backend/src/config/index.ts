// src/config/index.ts

import dotenv from 'dotenv';
import path from 'path';

// Load appropriate .env file based on environment
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env' 
  : `.env.${process.env.NODE_ENV || 'development'}`;

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export default {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'development_secret',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // AI Service
  aiProvider: process.env.AI_PROVIDER || 'openai',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4',
  aiCacheEnabled: process.env.AI_CACHE_ENABLED === 'true',
  aiCacheTtl: parseInt(process.env.AI_CACHE_TTL || '3600'),
  
  // App info
  appName: process.env.APP_NAME || 'Production Chatbot',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Rate limiting
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per window
  },
  
// src/config/index.ts (continued)

  // Cors
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true
  },
  
  // WebSocket
  ws: {
    path: process.env.WS_PATH || '/ws',
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000'), // 30 seconds
  },
  
  // Monitoring
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    metricsPath: process.env.METRICS_PATH || '/metrics',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '300000'), // 5 minutes
  }
};