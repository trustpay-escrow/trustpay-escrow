import { Router } from 'express';
import { getProjectMessages, sendMessage } from './message.controller.js';

const router = Router();

router.get('/projects/:projectId/messages', getProjectMessages);
router.post('/projects/:projectId/messages', sendMessage);

export default router;
