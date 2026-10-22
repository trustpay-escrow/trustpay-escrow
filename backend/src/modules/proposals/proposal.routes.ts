import { Router } from 'express';
import {
  createProposal,
  getProposalsByProject,
  getProposalsByFreelancer,
  updateProposalStatus,
} from './proposal.controller.js';
import { cacheMiddleware, invalidateCache } from '../../shared/middleware/cache.js';

const router = Router();

router.post(
  '/',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/proposals*', 'cache:/api/projects*']);
    next();
  },
  createProposal
);

// Cache proposals queries for 30 seconds
router.get('/project/:projectId', cacheMiddleware(30), getProposalsByProject);
router.get('/freelancer/:address', cacheMiddleware(30), getProposalsByFreelancer);

router.patch(
  '/:id/status',
  async (req, res, next) => {
    await invalidateCache(['cache:/api/proposals*', 'cache:/api/projects*']);
    next();
  },
  updateProposalStatus
);

export default router;
