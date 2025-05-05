// src/server.ts - Application entry point

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import app from './app';
import { logger } from './utils/logger';
import websocketService from './services/websocketService';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    await mongoose.connect(MONGODB_URI);
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

// Start server
const startServer = async () => {
  await connectDB();
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Initialize WebSocket service
  websocketService.initialize(server);
  
  // Start HTTP server
  server.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`WebSocket server available at ws://localhost:${PORT}/ws`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err: Error) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
};

startServer();