import { Router } from 'express';
import {
  getNotificationsHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from './notification.controller.js';

const router = Router();

router.get('/:address', getNotificationsHandler);
router.patch('/:id/read', markAsReadHandler);
router.patch('/read-all/:address', markAllAsReadHandler);
router.delete('/:id', deleteNotificationHandler);

export default router;
