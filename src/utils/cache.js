import { createClient } from 'redis';
import logger from './logger.js';

const redisClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('End of retry, timeout exceeded');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

/**
 * Get a value from cache
 */
export const getFromCache = async (key) => {
  try {
    const value = await redisClient.get(key);
    if (value) {
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(value);
    }
    logger.debug(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
};

/**
 * Set a value in cache with TTL
 */
export const setInCache = async (key, value, ttl = null) => {
  try {
    const serialized = JSON.stringify(value);
    const options = {};
    
    if (ttl) {
      options.EX = ttl;
    } else if (process.env.REDIS_CACHE_TTL) {
      options.EX = parseInt(process.env.REDIS_CACHE_TTL);
    }

    await redisClient.set(key, serialized, options);
    logger.debug(`Cache SET: ${key} with TTL: ${options.EX || 'no expiry'}`);
    return true;
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete a key from cache
 */
export const deleteFromCache = async (key) => {
  try {
    await redisClient.del(key);
    logger.debug(`Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
};

/**
 * Clear all cache
 */
export const clearCache = async (pattern = '*') => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    logger.debug(`Cache CLEAR: ${keys.length} keys removed`);
    return keys.length;
  } catch (error) {
    logger.error('Cache clear error:', error);
    return 0;
  }
};

/**
 * Increment counter in cache
 */
export const incrementCache = async (key, increment = 1) => {
  try {
    const result = await redisClient.incrBy(key, increment);
    return result;
  } catch (error) {
    logger.error(`Cache increment error for key ${key}:`, error);
    return null;
  }
};

export default redisClient;
