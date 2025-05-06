// src/services/redisService.ts

import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Initialize Redis client with options
const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  client.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });

  client.on('reconnecting', () => {
    logger.warn('Redis reconnecting...');
  });

  return client;
};

const redisClient = createRedisClient();

// Cache methods
const cacheSet = async (key: string, value: any, expiry?: number): Promise<void> => {
  try {
    if (expiry) {
      await redisClient.set(key, JSON.stringify(value), 'EX', expiry);
    } else {
      await redisClient.set(key, JSON.stringify(value));
    }
  } catch (error) {
    logger.error(`Redis cache set error: ${error.message}`);
  }
};

const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) as T : null;
  } catch (error) {
    logger.error(`Redis cache get error: ${error.message}`);
    return null;
  }
};

const cacheDelete = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error(`Redis cache delete error: ${error.message}`);
  }
};

// Export redis client and methods
export { redisClient, cacheSet, cacheGet, cacheDelete };