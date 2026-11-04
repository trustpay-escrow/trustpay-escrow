import { Router } from 'express';
import { getProjects, createProject, getProjectById, updateProject } from './project.controller.js';
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

// Invalidate cache when project status or on-chain metadata is updated
router.patch(
  '/:id',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  updateProject
);

export default router;
