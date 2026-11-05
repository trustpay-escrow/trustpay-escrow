import { Router } from 'express';
import { getProjectMessages, sendMessage } from './message.controller.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

// Protected by SEP-0010 Authenticate
router.get('/projects/:projectId/messages', authenticate, getProjectMessages);
router.post('/projects/:projectId/messages', authenticate, sendMessage);

export default router;
