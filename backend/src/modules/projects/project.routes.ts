import { Router } from 'express';
import { getProjects, createProject, getProjectById } from './project.controller.js';
import { cacheMiddleware, invalidateCache } from '../../shared/middleware/cache.js';

const router = Router();

// Cache projects listing for 60 seconds
router.get('/', cacheMiddleware(60), getProjects);

// Cache single project details for 60 seconds
router.get('/:id', cacheMiddleware(60), getProjectById);

// Invalidate cache when new project is created
router.post(
  '/',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  createProject
);

export default router;

