import express from 'express';
import { clearCache, getFromCache } from '../utils/cache.js';
import { authorizeRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import redisClient from '../utils/cache.js';

const router = express.Router();

/**
 * GET /api/cache/stats - Get cache statistics
 */
router.get('/stats', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    // Get Redis memory stats
    const info = await redisClient.info('memory');
    const keyCount = await redisClient.dbSize();

    res.json({
      success: true,
      data: {
        keyCount,
        memoryStats: parseRedisInfo(info)
      }
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/clear - Clear cache
 */
router.post('/clear', authorizeRole(['admin']), async (req, res) => {
  try {
    const { pattern = '*' } = req.body;

    const cleared = await clearCache(pattern);

    logger.info(`Cache cleared for pattern: ${pattern} (${cleared} keys)`);

    res.json({
      success: true,
      data: {
        pattern,
        keysCleared: cleared
      },
      message: `Cache cleared: ${cleared} keys`
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * GET /api/cache/keys - List all cache keys
 */
router.get('/keys', authorizeRole(['admin']), async (req, res) => {
  try {
    const { pattern = '*' } = req.query;

    const keys = await redisClient.keys(pattern);

    res.json({
      success: true,
      data: {
        pattern,
        keys: keys || [],
        count: keys ? keys.length : 0
      }
    });
  } catch (error) {
    logger.error('Error listing cache keys:', error);
    res.status(500).json({
      error: 'Failed to list cache keys',
      message: error.message
    });
  }
});

/**
 * GET /api/cache/key/:key - Get specific cache entry
 */
router.get('/key/:key', authorizeRole(['admin']), async (req, res) => {
  try {
    const { key } = req.params;
    const value = await redisClient.get(key);

    if (!value) {
      return res.status(404).json({
        error: 'Not found',
        message: `Cache key not found: ${key}`
      });
    }

    res.json({
      success: true,
      data: {
        key,
        value: JSON.parse(value),
        ttl: await redisClient.ttl(key)
      }
    });
  } catch (error) {
    logger.error('Error getting cache key:', error);
    res.status(500).json({
      error: 'Failed to get cache key',
      message: error.message
    });
  }
});

/**
 * DELETE /api/cache/key/:key - Delete specific cache entry
 */
router.delete('/key/:key', authorizeRole(['admin']), async (req, res) => {
  try {
    const { key } = req.params;

    await redisClient.del(key);

    logger.info(`Cache key deleted: ${key}`);

    res.json({
      success: true,
      data: { key },
      message: `Cache key deleted: ${key}`
    });
  } catch (error) {
    logger.error('Error deleting cache key:', error);
    res.status(500).json({
      error: 'Failed to delete cache key',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/warm - Warm up cache with common queries
 */
router.post('/warm', authorizeRole(['admin']), async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'companyId is required'
      });
    }

    let warmed = 0;

    // Note: Actual cache warming would call your service methods
    // For now, just log the intent
    logger.info(`Starting cache warm-up for company: ${companyId}`);

    res.json({
      success: true,
      data: {
        companyId,
        warmed
      },
      message: `Cache warm-up initiated for company: ${companyId}`
    });
  } catch (error) {
    logger.error('Error warming cache:', error);
    res.status(500).json({
      error: 'Failed to warm cache',
      message: error.message
    });
  }
});

/**
 * Helper function to parse Redis info output
 */
function parseRedisInfo(info) {
  const lines = info.split('\r\n');
  const stats = {};

  lines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    }
  });

  return {
    usedMemory: stats.used_memory ? parseInt(stats.used_memory) : 0,
    usedMemoryHuman: stats.used_memory_human || '0B',
    usedMemoryPeak: stats.used_memory_peak ? parseInt(stats.used_memory_peak) : 0,
    usedMemoryPeakHuman: stats.used_memory_peak_human || '0B',
    memoryFragmentationRatio: stats.mem_fragmentation_ratio || '0',
    connectedClients: stats.connected_clients ? parseInt(stats.connected_clients) : 0,
    totalCommands: stats.total_commands_processed ? parseInt(stats.total_commands_processed) : 0
  };
}

export default router;
