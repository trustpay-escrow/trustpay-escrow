import { Router } from 'express';
import {
  createProposal,
  getProposalsByProject,
  getProposalsByFreelancer,
  updateProposalStatus,
} from '../controllers/proposalController.js';

const router = Router();

// Create new proposal
router.post('/', createProposal);

// Get proposals for a project
router.get('/project/:projectId', getProposalsByProject);

// Get proposals for a freelancer address
router.get('/freelancer/:address', getProposalsByFreelancer);

// Update proposal status (accept / deny)
router.patch('/:id/status', updateProposalStatus);

export default router;
