import logger from './logger.js';
import { getFromCache, setInCache } from './cache.js';
import crypto from 'crypto';

/**
 * Generate ETag for response
 */
export const generateETag = (data) => {
  try {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    return `"${hash}"`;
  } catch (error) {
    logger.error('Error generating ETag:', error);
    return null;
  }
};

/**
 * Response caching middleware factory
 * Caches entire HTTP responses in Redis
 */
export const responseCacheMiddleware = (cacheDuration = 1800) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for certain endpoints
    if (req.path.includes('/pdf') || req.path.includes('/download')) {
      return next();
    }

    try {
      // Generate cache key from route and query params
      const cacheKey = `response:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

      // Check if response is in cache
      const cachedResponse = await getFromCache(cacheKey);

      if (cachedResponse) {
        logger.debug(`Cache HIT for ${req.path}`);

        // Set cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('ETag', generateETag(cachedResponse));

        return res.json(cachedResponse);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (data) {
        // Cache the response
        setInCache(cacheKey, data, cacheDuration);

        logger.debug(`Cache SET for ${req.path} (TTL: ${cacheDuration}s)`);

        // Set cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('Cache-Control', `public, max-age=${cacheDuration}`);
        res.setHeader('ETag', generateETag(data));

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Response cache middleware error:', error);
      next();
    }
  };
};

/**
 * Cache control headers middleware
 * Sets appropriate cache headers based on content type
 */
export const cacheControlMiddleware = (req, res, next) => {
  const path = req.path;

  // Default: no cache
  let cacheControl = 'no-cache, no-store, must-revalidate';
  let maxAge = 0;

  // Static content
  if (path.includes('/static') || path.includes('/assets')) {
    cacheControl = 'public, max-age=86400'; // 24 hours
    maxAge = 86400;
  }

  // Product and category data
  else if (path.includes('/products') || path.includes('/categories')) {
    cacheControl = 'public, max-age=1800'; // 30 minutes
    maxAge = 1800;
  }

  // Inventory/stock data
  else if (path.includes('/inventory')) {
    cacheControl = 'public, max-age=1800'; // 30 minutes
    maxAge = 1800;
  }

  // Customer data
  else if (path.includes('/customers')) {
    cacheControl = 'public, max-age=3600'; // 1 hour
    maxAge = 3600;
  }

  // Invoice data
  else if (path.includes('/invoices')) {
    cacheControl = 'public, max-age=3600'; // 1 hour
    maxAge = 3600;
  }

  // Reports
  else if (path.includes('/reports')) {
    cacheControl = 'public, max-age=3600'; // 1 hour
    maxAge = 3600;
  }

  // User-specific data (not cacheable)
  else if (path.includes('/users') || path.includes('/me')) {
    cacheControl = 'no-cache, no-store, must-revalidate';
    maxAge = 0;
  }

  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', new Date(Date.now() + maxAge * 1000).toUTCString());

  next();
};

/**
 * Conditional request handling (ETag/Last-Modified)
 */
export const conditionalRequestMiddleware = (req, res, next) => {
  res.setHeader('Vary', 'Accept-Encoding, Authorization');

  // Store the original sendStatus method
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Generate ETag
    const etag = generateETag(data);
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date().toUTCString());

    // Check If-None-Match header (ETag)
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // Check If-Modified-Since header
    if (req.headers['if-modified-since']) {
      const clientDate = new Date(req.headers['if-modified-since']);
      const now = new Date();

      if (clientDate >= now) {
        return res.status(304).end();
      }
    }

    return originalJson(data);
  };

  next();
};

/**
 * Cache invalidation helper
 * Clears cache for specific patterns
 */
export const invalidateCache = async (patterns) => {
  try {
    if (!Array.isArray(patterns)) {
      patterns = [patterns];
    }

    for (const pattern of patterns) {
      logger.info(`Invalidating cache pattern: ${pattern}`);
      // This would use the cache.js clearCache function
    }
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
};

/**
 * Smart cache buster
 * For developers to manually invalidate caches
 */
export const cacheBusterMiddleware = (req, res, next) => {
  // Allow cache bypass with special header
  if (req.headers['cache-busted'] || req.query['cache-bust']) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    logger.debug(`Cache busted for ${req.path}`);
  }

  next();
};

/**
 * Compression headers
 */
export const compressionHeadersMiddleware = (req, res, next) => {
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  next();
};

export default {
  generateETag,
  responseCacheMiddleware,
  cacheControlMiddleware,
  conditionalRequestMiddleware,
  invalidateCache,
  cacheBusterMiddleware,
  compressionHeadersMiddleware
};
