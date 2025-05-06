// src/middleware/metrics.ts - Prometheus metrics middleware

import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import { logger } from '../utils/logger';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Active requests gauge
const httpRequestsActive = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
  registers: [register],
});

// Chat metrics
const chatMessagesTotal = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages',
  labelNames: ['role'],
  registers: [register],
});

const chatResponseTimeSeconds = new promClient.Histogram({
  name: 'chat_response_time_seconds',
  help: 'AI response generation time in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20],
  registers: [register],
});

// Authentication metrics
const authAttempts = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['success'],
  registers: [register],
});

// src/middleware/metrics.ts

// Add business metrics
const userMetrics = new promClient.Gauge({
  name: 'chatbot_active_users_total',
  help: 'Total number of active users',
  registers: [register],
});

const conversationMetrics = new promClient.Gauge({
  name: 'chatbot_conversations_total',
  help: 'Total number of conversations',
  registers: [register],
});

const messageMetrics = new promClient.Gauge({
  name: 'chatbot_messages_total',
  help: 'Total number of messages',
  registers: [register],
});

// Add function to update business metrics
export const updateBusinessMetrics = async () => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.model('User');
    const Conversation = mongoose.model('Conversation');
    
    // Update user metrics
    const activeUsers = await User.countDocuments({
      'usage.lastActive': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    userMetrics.set(activeUsers);
    
    // Update conversation metrics
    const totalConversations = await Conversation.countDocuments();
    conversationMetrics.set(totalConversations);
    
    // Update message metrics - count all messages across all conversations
    const result = await Conversation.aggregate([
      { $unwind: '$messages' },
      { $count: 'total' }
    ]);
    
    if (result.length > 0) {
      messageMetrics.set(result[0].total);
    }
  } catch (error) {
    logger.error('Error updating business metrics:', error);
  }
};

// Schedule metrics update
setInterval(updateBusinessMetrics, 5 * 60 * 1000); // Every 5 minutes

// Add metrics for AI response time
export const trackAIResponseTime = (durationSec: number) => {
  chatResponseTimeSeconds.observe(durationSec);
};

// Initialize metrics middleware
export const initMetrics = () => {
  logger.info('Initializing Prometheus metrics');
};

// Metrics endpoint
export const metricsEndpoint = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end();
  }
};

// Request metrics middleware
export const requestMetrics = (req: Request, res: Response, next: NextFunction) => {
  const route = (req.route?.path) ? req.route.path : req.path;
  const method = req.method;
  
  // Skip metrics route to avoid circular metrics
  if (req.path === '/metrics') {
    return next();
  }
  
  // Increment active requests
  httpRequestsActive.inc({ method, route });
  
  // Start timer
  const startTime = process.hrtime();
  
  // Record metrics on response finish
  res.on('finish', () => {
    // Decrement active requests
    httpRequestsActive.dec({ method, route });
    
    // Calculate request duration
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    
    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: res.statusCode });
    httpRequestDurationSeconds.observe(
      { method, route, status_code: res.statusCode },
      duration
    );
  });
  
  next();
};

// Chat metrics tracking
export const trackChatMessage = (role: 'user' | 'assistant' | 'system') => {
  chatMessagesTotal.inc({ role });
};

export const trackChatResponseTime = (durationSec: number) => {
  chatResponseTimeSeconds.observe(durationSec);
};

// Auth metrics tracking
export const trackAuthAttempt = (success: boolean) => {
  authAttempts.inc({ success: success.toString() });
};

export { register };