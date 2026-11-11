import { Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { createNotification } from '../notifications/notification.service.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.js';
import { realtimeService } from '../../services/realtime.service.js';

export interface ProjectParticipantsInfo {
  project: any;
  clientAddress?: string;
  freelancerAddress?: string;
  arbiterAddress?: string;
  participantAddresses: string[];
}

/**
 * Resolves the participants (client, freelancer, arbiter) for a given project ID.
 */
export async function getProjectParticipants(projectId: string): Promise<ProjectParticipantsInfo | null> {
  const { data: project, error: pError } = await supabase
    .from('projects')
    .select('id, title, client_id, freelancer_id, arbiter_id')
    .eq('id', projectId)
    .maybeSingle();

  if (pError || !project) {
    return null;
  }

  const userIds = [project.client_id, project.freelancer_id, project.arbiter_id].filter(Boolean);
  let clientAddress: string | undefined;
  let freelancerAddress: string | undefined;
  let arbiterAddress: string | undefined;
  const participantAddresses: string[] = [];

  if (userIds.length > 0) {
    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, stellar_address')
      .in('id', userIds);

    if (!uError && users) {
      const userMap = new Map(users.map((u) => [u.id, u.stellar_address]));
      clientAddress = project.client_id ? userMap.get(project.client_id) : undefined;
      freelancerAddress = project.freelancer_id ? userMap.get(project.freelancer_id) : undefined;
      arbiterAddress = project.arbiter_id ? userMap.get(project.arbiter_id) : undefined;

      if (clientAddress) participantAddresses.push(clientAddress.toUpperCase());
      if (freelancerAddress) participantAddresses.push(freelancerAddress.toUpperCase());
      if (arbiterAddress) participantAddresses.push(arbiterAddress.toUpperCase());
    }
  }

  return {
    project,
    clientAddress,
    freelancerAddress,
    arbiterAddress,
    participantAddresses,
  };
}

export function isUserAuthorizedForProject(
  userAddress: string,
  userRole: string | undefined,
  participants: ProjectParticipantsInfo
): boolean {
  const normalizedUser = userAddress.toUpperCase();
  if (participants.participantAddresses.includes(normalizedUser)) {
    return true;
  }
  if (userRole === 'arbiter' || userRole === 'admin') {
    return true;
  }
  return false;
}

/**
 * GET /api/projects/:projectId/messages
 * Retrieves chat history for a project. Enforces participant authorization (IDOR protection).
 */
export const getProjectMessages = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const rawProjectId = req.params.projectId;
    const projectId = (Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId) as string;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const userAddress = req.user?.stellar_address;
    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const participantsInfo = await getProjectParticipants(projectId);
    if (!participantsInfo) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!isUserAuthorizedForProject(userAddress, req.user?.role, participantsInfo)) {
      logger.warn(`Unauthorized access attempt to project ${projectId} messages by ${userAddress}`);
      return res.status(403).json({
        error: 'Forbidden: You are not an authorized participant (client, freelancer, or arbiter) of this project',
      });
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

/**
 * POST /api/projects/:projectId/messages
 * Sends a message in a project. Enforces anti-spoofing and participant-only messaging.
 */
export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const rawProjectId = req.params.projectId;
    const projectId = (Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId) as string;
    const { sender_address, receiver_address, content } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const userAddress = req.user?.stellar_address;
    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Anti-spoofing: sender_address in request body must match authenticated user
    if (sender_address && sender_address.trim().toUpperCase() !== userAddress.toUpperCase()) {
      logger.warn(`Sender address spoofing attempt by ${userAddress} attempting to send as ${sender_address}`);
      return res.status(403).json({ error: 'Forbidden: You cannot send messages on behalf of another user' });
    }

    const effectiveSenderAddress = userAddress.trim();
    const effectiveReceiverAddress = (receiver_address || '').trim();

    if (!effectiveReceiverAddress || !content?.trim()) {
      return res.status(400).json({ error: 'receiver_address and content are required' });
    }

    if (effectiveSenderAddress.toUpperCase() === effectiveReceiverAddress.toUpperCase()) {
      return res.status(400).json({ error: 'Receiver address cannot be identical to sender address' });
    }

    // Verify project exists and participants
    const participantsInfo = await getProjectParticipants(projectId);
    if (!participantsInfo) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify sender is authorized participant
    if (!isUserAuthorizedForProject(effectiveSenderAddress, req.user?.role, participantsInfo)) {
      return res.status(403).json({
        error: 'Forbidden: You are not an authorized participant of this project',
      });
    }

    // Verify receiver is a participant in this project
    const normalizedReceiver = effectiveReceiverAddress.toUpperCase();
    const isReceiverValid =
      participantsInfo.participantAddresses.includes(normalizedReceiver) ||
      req.user?.role === 'arbiter';

    if (!isReceiverValid) {
      return res.status(400).json({
        error: 'Forbidden: Receiver address is not an authorized participant of this project',
      });
    }

    // Insert message into Supabase
    const { data: message, error } = await supabase
      .from('messages')
      .insert([
        {
          project_id: projectId,
          sender_address: effectiveSenderAddress,
          receiver_address: effectiveReceiverAddress,
          content: content.trim(),
        },
      ])
      .select('*')
      .single();

    if (error) {
      logger.error('Error inserting message to Supabase:', error);
      return res.status(500).json({ error: 'Failed to send message', details: error.message });
    }

    // Broadcast new message in real time to all connected clients on this project SSE stream
    realtimeService.broadcastToProject(projectId, 'message', message);

    // Trigger notification to receiver (which also pushes to user SSE stream)
    await createNotification({
      recipient_address: effectiveReceiverAddress,
      sender_address: effectiveSenderAddress,
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

/**
 * GET /api/projects/:projectId/messages/stream
 * Real-time SSE stream for project chat messages and on-chain ledger events.
 */
export const streamProjectMessages = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const rawProjectId = req.params.projectId;
    const projectId = (Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId) as string;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const userAddress = req.user?.stellar_address;
    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const participantsInfo = await getProjectParticipants(projectId);
    if (!participantsInfo) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!isUserAuthorizedForProject(userAddress, req.user?.role, participantsInfo)) {
      return res.status(403).json({
        error: 'Forbidden: You are not an authorized participant of this project',
      });
    }

    realtimeService.registerProjectStream(projectId, res);
  } catch (err: any) {
    logger.error('Unexpected error in streamProjectMessages:', err);
    return res.status(500).json({ error: 'Failed to establish project realtime stream' });
  }
};
