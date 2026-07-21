import { Router } from 'express';
import { getProjects, createProject, getProjectById } from '../controllers/projectController.js';

const router = Router();

// Get all projects for a user
router.get('/', getProjects);

// Create a new project (draft)
router.post('/', createProject);

// Get a specific project
router.get('/:id', getProjectById);

export default router;
