// src/utils/logger.ts

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define log directory
const logDir = 'logs';

// Configure transport for production logs (daily rotate file)
const prodTransports = [
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Define transports
const transports = [
  // Always console in development
  ...(process.env.NODE_ENV !== 'production' 
    ? [new winston.transports.Console({ format: consoleFormat })]
    : []),
  // Always file in production
  ...(process.env.NODE_ENV === 'production' ? prodTransports : []),
];

// Create logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.json(),
  transports,
  exitOnError: false,
});

// HTTP request logger
const httpLogger = (req, res, next) => {
  // Skip logging for health checks and metrics
  if (req.path === '/health' || req.path === '/metrics' || req.path === '/ping') {
    return next();
  }
  
  // Log request details
  logger.http(`${req.method} ${req.url} ${req.ip}`);
  next();
};

export { logger, httpLogger };