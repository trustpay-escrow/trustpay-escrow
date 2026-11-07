import { Router } from 'express';
import { createMilestone, updateMilestoneStatus, requestRevision } from './milestone.controller.js';
import { invalidateCache } from '../../shared/middleware/cache.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

// Protected by SEP-0010 Authenticate
router.post(
  '/',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  createMilestone
);

// Protected by SEP-0010 Authenticate
router.patch(
  '/:id/status',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  updateMilestoneStatus
);

// Protected by SEP-0010 Authenticate
router.post(
  '/:id/request-revision',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/projects*']);
    next();
  },
  requestRevision
);

export default router;
