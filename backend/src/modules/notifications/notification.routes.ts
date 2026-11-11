import { Router } from 'express';
import {
  getNotificationsHandler,
  streamNotificationsHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from './notification.controller.js';
import { authenticate } from '../../shared/middleware/auth.js';

const router = Router();

// Real-Time Push Gateway (SSE) endpoints (placed before /:address to prevent path param collision)
router.get('/stream', authenticate, streamNotificationsHandler);
router.get('/stream/:address', authenticate, streamNotificationsHandler);

// Protected Notification CRUD endpoints
router.get('/:address', authenticate, getNotificationsHandler);
router.patch('/:id/read', authenticate, markAsReadHandler);
router.patch('/read-all/:address', authenticate, markAllAsReadHandler);
router.delete('/:id', authenticate, deleteNotificationHandler);

export default router;
