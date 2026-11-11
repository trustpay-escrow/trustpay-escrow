import { Router } from 'express';
import { getProjectMessages, sendMessage, streamProjectMessages } from './message.controller.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

// Protected by SEP-0010 Authenticate & Participant Authorization
router.get('/projects/:projectId/messages', authenticate, getProjectMessages);
router.post('/projects/:projectId/messages', authenticate, sendMessage);
router.get('/projects/:projectId/messages/stream', authenticate, streamProjectMessages);

export default router;
