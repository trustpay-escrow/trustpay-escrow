import { Router } from 'express';

const router = Router();

// Create milestones for a project
router.post('/', async (req, res) => {
  // Placeholder for Supabase logic
  res.status(201).json({ message: 'Milestone created' });
});

// Update a milestone status (e.g. submitted)
router.patch('/:id/status', async (req, res) => {
  res.json({ message: `Milestone ${req.params.id} updated` });
});

export default router;
