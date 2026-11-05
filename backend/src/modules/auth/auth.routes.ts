import { Router } from 'express';
import { getChallenge, verifyChallenge, getMe, logout } from './auth.controller.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

router.get('/challenge', getChallenge);
router.post('/verify', verifyChallenge);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);

export default router;
