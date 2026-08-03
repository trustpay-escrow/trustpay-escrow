import { Router } from 'express';
import {
  getNotificationsHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from '../controllers/notificationController.js';

const router = Router();

// GET /api/notifications/:address
router.get('/:address', getNotificationsHandler);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markAsReadHandler);

// PATCH /api/notifications/read-all/:address
router.patch('/read-all/:address', markAllAsReadHandler);

// DELETE /api/notifications/:id
router.delete('/:id', deleteNotificationHandler);

export default router;
