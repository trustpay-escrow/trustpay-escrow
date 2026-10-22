import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../../config/redis.js';
import { logger } from '../utils/logger.js';

/**
 * Express middleware to cache GET requests in Redis
 * @param ttlSeconds Time-to-live in seconds (default 60s)
 * @param keyPrefix Custom prefix for cache keys
 */
export const cacheMiddleware = (ttlSeconds = 60, keyPrefix = 'cache') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache safe GET requests
    if (req.method !== 'GET' || !redisCache.isReady()) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;

    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.send(cached);
      }

      res.setHeader('X-Cache', 'MISS');

      // Intercept res.send/res.json to store response in Redis
      const originalSend = res.send.bind(res);

      res.send = (body: any) => {
        // Only cache successful 200 responses
        if (res.statusCode === 200 && body) {
          const serialized = typeof body === 'string' ? body : JSON.stringify(body);
          redisCache.set(cacheKey, serialized, ttlSeconds).catch((err) => {
            logger.debug(`[Cache] Failed to set key ${cacheKey}: ${err.message}`);
          });
        }
        return originalSend(body);
      };

      next();
    } catch (error: any) {
      logger.warn(`[Cache] Middleware error: ${error.message}`);
      res.setHeader('X-Cache', 'ERROR');
      next();
    }
  };
};

/**
 * Utility to invalidate caches when data is created, updated, or deleted
 * @param patterns Array of glob patterns to clear, e.g. ['cache:/api/projects*']
 */
export const invalidateCache = async (patterns: string[]): Promise<void> => {
  if (!redisCache.isReady()) return;
  for (const pattern of patterns) {
    await redisCache.delByPattern(pattern);
  }
};
