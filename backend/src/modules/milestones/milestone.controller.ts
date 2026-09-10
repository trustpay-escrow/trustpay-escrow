import { Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { milestoneArraySchema } from '../../shared/utils/validators.js';
import { createNotification } from '../notifications/notification.service.js';

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
      .select('*')
      .single();

    if (error) {
      logger.error(`Error updating milestone ${id}:`, error);
      return res.status(500).json({ error: 'Failed to update milestone status' });
    }

    let enrichedProject: any = null;
    if (updated?.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, title, client_id, freelancer_id')
        .eq('id', updated.project_id)
        .single();

      if (proj) {
        const userIds = [proj.client_id, proj.freelancer_id].filter(Boolean);
        let usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, stellar_address')
            .in('id', userIds);
          if (users) {
            for (const u of users) {
              usersMap[u.id] = u.stellar_address;
            }
          }
        }
        enrichedProject = {
          ...proj,
          client: proj.client_id ? { stellar_address: usersMap[proj.client_id] } : null,
          freelancer: proj.freelancer_id ? { stellar_address: usersMap[proj.freelancer_id] } : null,
        };
      }
    }

    const milestoneWithProject = {
      ...updated,
      projects: enrichedProject,
    };

    (async () => {
      try {
        const projectTitle = milestoneWithProject?.projects?.title || 'Project';
        const clientAddress = milestoneWithProject?.projects?.client?.stellar_address;
        const freelancerAddress = milestoneWithProject?.projects?.freelancer?.stellar_address;

        if (status === 'submitted' && clientAddress) {
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

    return res.json({ message: `Milestone ${id} status updated to ${status}`, milestone: milestoneWithProject });
  } catch (err: any) {
    logger.error('Unexpected error updating milestone status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
