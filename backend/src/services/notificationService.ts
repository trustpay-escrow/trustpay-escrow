import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export interface CreateNotificationInput {
  recipient_address: string;
  sender_address?: string;
  project_id?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    if (!input.recipient_address || !input.title || !input.message) {
      logger.warn('Skipping notification creation: missing required fields', input);
      return null;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          recipient_address: input.recipient_address,
          sender_address: input.sender_address || null,
          project_id: input.project_id || null,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link || null,
          is_read: false,
        },
      ])
      .select('*')
      .single();

    if (error) {
      logger.error('Error creating notification in Supabase:', error);
      return null;
    }

    logger.info(`Notification created successfully for recipient ${input.recipient_address}: ${input.title}`);
    return data;
  } catch (err) {
    logger.error('Unexpected error creating notification:', err);
    return null;
  }
}

export async function getUserNotifications(recipientAddress: string, limit = 50) {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_address', recipientAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`Error fetching notifications for ${recipientAddress}:`, error);
      throw error;
    }

    const unreadCount = (notifications || []).filter((n) => !n.is_read).length;

    return {
      notifications: notifications || [],
      unreadCount,
    };
  } catch (err) {
    logger.error('Unexpected error fetching user notifications:', err);
    throw err;
  }
}

export async function markAsRead(id: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error(`Error marking notification ${id} as read:`, error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('Unexpected error marking notification as read:', err);
    throw err;
  }
}

export async function markAllAsRead(recipientAddress: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_address', recipientAddress)
      .eq('is_read', false)
      .select('*');

    if (error) {
      logger.error(`Error marking all notifications as read for ${recipientAddress}:`, error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('Unexpected error marking all notifications as read:', err);
    throw err;
  }
}

export async function deleteNotification(id: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`Error deleting notification ${id}:`, error);
      throw error;
    }

    return true;
  } catch (err) {
    logger.error('Unexpected error deleting notification:', err);
    throw err;
  }
}
