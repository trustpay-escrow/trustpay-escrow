import { Request, Response } from 'express';

import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { milestoneArraySchema } from '../utils/validators.js';
import { createNotification } from '../services/notificationService.js';

// Create milestones for a project
export const createMilestone = async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId, milestones } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const validationResult = milestoneArraySchema.safeParse(milestones);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map(i => `${i.path.join('.') || 'field'}: ${i.message}`)
        .join(' | ');
      return res.status(400).json({
        error: `Validation failed: ${errorMessages}`,
        details: validationResult.error.issues
      });
    }

    const milestonesToInsert = validationResult.data.map((m) => ({
      project_id: projectId,
      milestone_index: m.milestone_index,
      title: m.title,
      description: m.description,
      amount: m.amount,
      due_date: m.due_date,
      revision_limit: m.revision_limit,
      deliverable_type: m.deliverable_type,
      status: 'pending'
    }));

    const { data, error } = await supabase
      .from('milestones')
      .insert(milestonesToInsert)
      .select();

    if (error) {
      logger.error('Error inserting milestones to Supabase:', error);
      return res.status(500).json({ error: 'Failed to create milestones', details: error });
    }

    return res.status(201).json({ message: 'Milestones created successfully', milestones: data });
  } catch (err: any) {
    logger.error('Unexpected error creating milestones:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a milestone status (e.g. submitted, approved, disputed)
export const updateMilestoneStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, actor_address } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'Milestone ID and status are required' });
    }

    const validStatuses = ['pending', 'submitted', 'approved', 'disputed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid milestone status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updatePayload: Record<string, any> = { status };
    if (status === 'submitted') {
      const now = new Date();
      const autoReleaseDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      updatePayload.submitted_at = now.toISOString();
      updatePayload.auto_release_at = autoReleaseDate.toISOString();
    }

    const { data: updated, error } = await supabase
      .from('milestones')
      .update(updatePayload)
      .eq('id', id)
      .select('*, projects(id, title, client_id, freelancer_id, client:users!projects_client_id_fkey(stellar_address), freelancer:users!projects_freelancer_id_fkey(stellar_address))')
      .single();

    if (error) {
      logger.error(`Error updating milestone ${id}:`, error);
      return res.status(500).json({ error: 'Failed to update milestone status' });
    }

    // Trigger notification based on status change
    (async () => {
      try {
        const projectTitle = updated?.projects?.title || 'Project';
        const clientAddress = updated?.projects?.client?.stellar_address;
        const freelancerAddress = updated?.projects?.freelancer?.stellar_address;

        if (status === 'submitted' && clientAddress) {
          // Freelancer submitted work -> Notify client
          await createNotification({
            recipient_address: clientAddress,
            sender_address: actor_address || freelancerAddress,
            project_id: updated.project_id,
            type: 'milestone_submitted',
            title: 'Milestone Submitted for Review',
            message: `Milestone '${updated.title}' for project '${projectTitle}' was submitted for approval.`,
            link: `/projects?id=${updated.project_id}`,
          });
        } else if (status === 'approved' && freelancerAddress) {
          // Client approved milestone -> Notify freelancer
          await createNotification({
            recipient_address: freelancerAddress,
            sender_address: actor_address || clientAddress,
            project_id: updated.project_id,
            type: 'milestone_approved',
            title: 'Milestone Approved! 💰',
            message: `Milestone '${updated.title}' for project '${projectTitle}' was approved and funds released!`,
            link: `/projects?id=${updated.project_id}`,
          });
        }
      } catch (notifyErr) {
        logger.error('Error triggering milestone notification:', notifyErr);
      }
    })();

    return res.json({ message: `Milestone ${id} status updated to ${status}`, milestone: updated });
  } catch (err: any) {
    logger.error('Unexpected error updating milestone status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

