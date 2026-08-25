import { Router } from 'express';
import { getProjects, createProject, getProjectById } from './project.controller.js';

const router = Router();

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);

export default router;
