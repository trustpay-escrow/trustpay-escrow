import { Router } from 'express';
import { createMilestone, updateMilestoneStatus } from './milestone.controller.js';

const router = Router();

router.post('/', createMilestone);
router.patch('/:id/status', updateMilestoneStatus);

export default router;
