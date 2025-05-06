// src/server.ts

import config from './config';
import mongoose from 'mongoose';
import http from 'http';
import app from './app';
import { logger } from './utils/logger';
import websocketService from './services/websocketService';
import { updateBusinessMetrics } from './middleware/metrics';

// MongoDB connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 50
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!config.mongoUri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    await mongoose.connect(config.mongoUri, mongooseOptions);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`MongoDB connection error: ${error.message}`);
    } else {
      logger.error('Unknown MongoDB connection error');
    }
    // Exit process with failure
    process.exit(1);
  }
};

// Add MongoDB connection event listeners
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully');
});

// Start server
const startServer = async () => {
  // Connect to database
  await connectDB();
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Initialize WebSocket service
  websocketService.initialize(server);
  
  // Start HTTP server
  server.listen(config.port, () => {
    logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    logger.info(`WebSocket server available at ws://localhost:${config.port}${config.ws.path}`);
    
    if (config.nodeEnv !== 'production') {
      logger.info(`API Documentation available at http://localhost:${config.port}/api-docs`);
    }
  });
  
  // Initialize business metrics
  if (config.monitoring.metricsEnabled) {
    updateBusinessMetrics();
    setInterval(updateBusinessMetrics, config.monitoring.metricsInterval);
  }

  // Handle unhandled rejections
  process.on('unhandledRejection', (err: Error) => {
    logger.error(`Unhandled Rejection: ${err.message}`, {
      stack: err.stack
    });
    
    // Close server & exit process
    server.close(() => process.exit(1));
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err.message}`, {
      stack: err.stack
    });
    
    // Close server & exit process
    server.close(() => process.exit(1));
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    
    server.close(() => {
      logger.info('Process terminated.');
      process.exit(0);
    });
  });
};

// Start the server
startServer();