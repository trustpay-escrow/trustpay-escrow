import { Router } from 'express';
import {
  connectWallet,
  getNotificationPreferences,
  updateNotificationPreferences,
} from './user.controller.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

router.post('/connect', connectWallet);
router.get('/me/notification-preferences', authenticate, getNotificationPreferences);
router.put('/me/notification-preferences', authenticate, updateNotificationPreferences);

export default router;
