import { Router } from 'express';
import {
  createProposal,
  getProposalsByProject,
  getProposalsByFreelancer,
  updateProposalStatus,
  counterOfferProposal,
} from './proposal.controller.js';
import { cacheMiddleware, invalidateCache } from '../../shared/middleware/cache.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

// Protected by SEP-0010 Authenticate
router.post(
  '/',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/proposals*', 'cache:/api/projects*']);
    next();
  },
  createProposal
);

// Cache proposals queries for 30 seconds
router.get('/project/:projectId', cacheMiddleware(30), getProposalsByProject);
router.get('/freelancer/:address', cacheMiddleware(30), getProposalsByFreelancer);

// Two-way counter-offer negotiation (#150)
// Protected by SEP-0010 Authenticate
router.patch(
  '/:id/counter-offer',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/proposals*', 'cache:/api/projects*']);
    next();
  },
  counterOfferProposal
);

// Protected by SEP-0010 Authenticate
router.patch(
  '/:id/status',
  authenticate,
  async (req, res, next) => {
    await invalidateCache(['cache:/api/proposals*', 'cache:/api/projects*']);
    next();
  },
  updateProposalStatus
);

export default router;
