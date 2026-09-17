import { Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { createNotification } from '../notifications/notification.service.js';

export const getProjectMessages = async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        logger.warn(`Messages table missing, returning empty array for project ${projectId}`);
        return res.json({ messages: [] });
      }
      logger.error(`Error fetching messages for project ${projectId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch project messages' });
    }

    return res.json({ messages: messages || [] });
  } catch (err: any) {
    logger.error('Unexpected error fetching project messages:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const { sender_address, receiver_address, content } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    if (!sender_address || !receiver_address || !content?.trim()) {
      return res.status(400).json({ error: 'sender_address, receiver_address, and content are required' });
    }

    // Insert message into Supabase
    const { data: message, error } = await supabase
      .from('messages')
      .insert([
        {
          project_id: projectId,
          sender_address: sender_address.trim(),
          receiver_address: receiver_address.trim(),
          content: content.trim(),
        },
      ])
      .select('*')
      .single();

    if (error) {
      logger.error('Error inserting message to Supabase:', error);
      return res.status(500).json({ error: 'Failed to send message', details: error.message });
    }

    // Trigger notification to receiver
    await createNotification({
      recipient_address: receiver_address.trim(),
      sender_address: sender_address.trim(),
      project_id: projectId,
      type: 'new_message',
      title: 'New Message Received',
      message: `You have a new message: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
      link: `/projects/${projectId}`,
    });

    return res.status(201).json({
      message: 'Message sent successfully',
      data: message,
    });
  } catch (err: any) {
    logger.error('Unexpected error sending message:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
