import { Router } from 'express';
import { createMilestone, updateMilestoneStatus } from '../controllers/milestoneController.js';

const router = Router();

// Create milestones for a project
router.post('/', createMilestone);

// Update a milestone status (e.g. submitted)
router.patch('/:id/status', updateMilestoneStatus);

export default router;
