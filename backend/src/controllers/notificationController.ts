import { Request, Response } from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

// GET /api/notifications/:address
export const getNotificationsHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const address = req.params.address as string;
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const result = await getUserNotifications(address, limit);

    return res.json(result);
  } catch (err: any) {
    logger.error('Error in getNotificationsHandler:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// PATCH /api/notifications/:id/read
export const markAsReadHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const notification = await markAsRead(id);
    return res.json({ message: 'Notification marked as read', notification });
  } catch (err: any) {
    logger.error('Error in markAsReadHandler:', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// PATCH /api/notifications/read-all/:address
export const markAllAsReadHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const address = req.params.address as string;
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }

    const updated = await markAllAsRead(address);
    return res.json({ message: 'All notifications marked as read', updatedCount: updated?.length || 0 });
  } catch (err: any) {
    logger.error('Error in markAllAsReadHandler:', err);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// DELETE /api/notifications/:id
export const deleteNotificationHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    await deleteNotification(id);
    return res.json({ message: 'Notification deleted successfully' });
  } catch (err: any) {
    logger.error('Error in deleteNotificationHandler:', err);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
};
