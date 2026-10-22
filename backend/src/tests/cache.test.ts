import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { cacheMiddleware, invalidateCache } from '../shared/middleware/cache.js';
import { redisCache } from '../config/redis.js';

describe('Redis Cache Middleware & Invalidation', () => {
  it('bypasses caching when Redis is not connected', async () => {
    const testApp = express();
    testApp.get('/test-route', cacheMiddleware(30), (req, res) => {
      res.json({ data: 'fresh-data', timestamp: Date.now() });
    });

    const res = await request(testApp).get('/test-route');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('BYPASS');
    expect(res.body.data).toBe('fresh-data');
  });

  it('serves cached payload and returns X-Cache: HIT when cache is populated', async () => {
    const testApp = express();
    testApp.get('/cached-route', cacheMiddleware(30), (req, res) => {
      res.json({ message: 'original' });
    });

    // Mock redisCache methods
    const mockData = JSON.stringify({ message: 'from-cache' });
    vi.spyOn(redisCache, 'isReady').mockReturnValue(true);
    vi.spyOn(redisCache, 'get').mockResolvedValue(mockData);

    const res = await request(testApp).get('/cached-route');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body.message).toBe('from-cache');

    vi.restoreAllMocks();
  });

  it('safely handles invalidateCache without crashing when offline', async () => {
    await expect(invalidateCache(['cache:/api/projects*'])).resolves.not.toThrow();
  });
});
