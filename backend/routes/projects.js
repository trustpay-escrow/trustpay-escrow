import { Router } from 'express';

const router = Router();

// Get all projects for a user
router.get('/', async (req, res) => {
  // Placeholder for Supabase logic
  res.json({ message: 'List of projects' });
});

// Create a new project (draft)
router.post('/', async (req, res) => {
  // Placeholder for Supabase logic
  res.status(201).json({ message: 'Project created' });
});

// Get a specific project
router.get('/:id', async (req, res) => {
  res.json({ message: `Project ${req.params.id}` });
});

export default router;
