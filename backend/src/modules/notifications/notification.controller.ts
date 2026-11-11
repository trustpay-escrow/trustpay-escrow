import { Response } from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './notification.service.js';
import { logger } from '../../shared/utils/logger.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.js';
import { realtimeService } from '../../services/realtime.service.js';

export const getNotificationsHandler = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userAddress = req.user?.stellar_address;
    const rawAddress = req.params.address;
    const address = (Array.isArray(rawAddress) ? rawAddress[0] : rawAddress) as string;

    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }

    // Participant Authorization: caller cannot inspect another user's notifications
    if (userAddress.toUpperCase() !== address.toUpperCase()) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own notifications' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const result = await getUserNotifications(address, limit);

    return res.json(result);
  } catch (err: any) {
    logger.error('Error in getNotificationsHandler:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * GET /api/notifications/stream and GET /api/notifications/stream/:address
 * Real-time SSE stream pushing new notifications to the authenticated user.
 */
export const streamNotificationsHandler = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userAddress = req.user?.stellar_address;
    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rawAddress = req.params.address;
    const requestedAddress: string = (Array.isArray(rawAddress) ? rawAddress[0] : rawAddress) || userAddress;
    if (userAddress.toUpperCase() !== requestedAddress.toUpperCase()) {
      return res.status(403).json({ error: 'Forbidden: You can only subscribe to your own notification stream' });
    }

    realtimeService.registerUserStream(requestedAddress, res);
  } catch (err: any) {
    logger.error('Error in streamNotificationsHandler:', err);
    return res.status(500).json({ error: 'Failed to establish notifications realtime stream' });
  }
};

export const markAsReadHandler = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userAddress = req.user?.stellar_address;
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const notification = await markAsRead(id, userAddress);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ message: 'Notification marked as read', notification });
  } catch (err: any) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    logger.error('Error in markAsReadHandler:', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

export const markAllAsReadHandler = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userAddress = req.user?.stellar_address;
    const rawAddress = req.params.address;
    const address = (Array.isArray(rawAddress) ? rawAddress[0] : rawAddress) as string;

    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }

    if (userAddress.toUpperCase() !== address.toUpperCase()) {
      return res.status(403).json({ error: 'Forbidden: You can only mark your own notifications as read' });
    }

    const updated = await markAllAsRead(address);
    return res.json({ message: 'All notifications marked as read', updatedCount: updated?.length || 0 });
  } catch (err: any) {
    logger.error('Error in markAllAsReadHandler:', err);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

export const deleteNotificationHandler = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userAddress = req.user?.stellar_address;
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const deleted = await deleteNotification(id, userAddress);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ message: 'Notification deleted successfully' });
  } catch (err: any) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    logger.error('Error in deleteNotificationHandler:', err);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
};
