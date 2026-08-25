import { Router } from 'express';
import {
  createProposal,
  getProposalsByProject,
  getProposalsByFreelancer,
  updateProposalStatus,
} from './proposal.controller.js';

const router = Router();

router.post('/', createProposal);
router.get('/project/:projectId', getProposalsByProject);
router.get('/freelancer/:address', getProposalsByFreelancer);
router.patch('/:id/status', updateProposalStatus);

export default router;
