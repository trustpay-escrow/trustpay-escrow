import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../shared/utils/logger.js';

let client: Redis | null = null;
let isConnected = false;

if (env.redisUrl) {
  try {
    client = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn(`[Redis] Connection retry limit reached (${times}). Pausing retries.`);
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    });

    client.on('connect', () => {
      isConnected = true;
      logger.info('[Redis] Successfully connected to Redis cache server');
    });

    client.on('ready', () => {
      isConnected = true;
      logger.info('[Redis] Redis client is ready to process requests');
    });

    client.on('error', (err) => {
      isConnected = false;
      logger.warn(`[Redis] Connection error: ${err.message}`);
    });

    client.on('close', () => {
      isConnected = false;
      logger.info('[Redis] Connection closed');
    });

    // Attempt initial connect asynchronously
    client.connect().catch((err) => {
      logger.warn(`[Redis] Initial connection failed (${err.message}). Operating in graceful cache bypass mode.`);
    });
  } catch (error: any) {
    logger.warn(`[Redis] Failed to initialize Redis client: ${error.message}`);
  }
} else {
  logger.info('[Redis] No REDIS_URL provided. In-memory cache bypass enabled.');
}

export const redisCache = {
  isReady(): boolean {
    return isConnected && client !== null && client.status === 'ready';
  },

  async get(key: string): Promise<string | null> {
    if (!this.isReady() || !client) return null;
    try {
      return await client.get(key);
    } catch (err: any) {
      logger.warn(`[Redis] GET error for key ${key}: ${err.message}`);
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isReady() || !client) return;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, 'EX', ttlSeconds);
      } else {
        await client.set(key, value);
      }
    } catch (err: any) {
      logger.warn(`[Redis] SET error for key ${key}: ${err.message}`);
    }
  },

  async del(key: string | string[]): Promise<void> {
    if (!this.isReady() || !client) return;
    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err: any) {
      logger.warn(`[Redis] DEL error: ${err.message}`);
    }
  },

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isReady() || !client) return;
    try {
      const stream = client.scanStream({
        match: pattern,
        count: 100,
      });

      const keysToDelete: string[] = [];
      stream.on('data', (resultKeys: string[]) => {
        keysToDelete.push(...resultKeys);
      });

      stream.on('end', async () => {
        if (keysToDelete.length > 0 && client) {
          await client.del(...keysToDelete);
          logger.debug(`[Redis] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
        }
      });
    } catch (err: any) {
      logger.warn(`[Redis] delByPattern error for pattern ${pattern}: ${err.message}`);
    }
  },

  getClient(): Redis | null {
    return client;
  },

  async disconnect(): Promise<void> {
    if (client) {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  },
};
