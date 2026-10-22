import { Router } from 'express';
import { createMilestone, updateMilestoneStatus } from './milestone.controller.js';
import { invalidateCache } from '../../shared/middleware/cache.js';

const router = Router();

router.post(
  '/',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  createMilestone
);

router.patch(
  '/:id/status',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  updateMilestoneStatus
);

export default router;
