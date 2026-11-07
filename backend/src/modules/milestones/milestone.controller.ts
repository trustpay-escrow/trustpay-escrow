import { Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import {
  milestoneArraySchema,
  updateMilestoneStatusSchema,
  requestRevisionSchema,
} from '../../shared/utils/validators.js';
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

    if (!id) {
      return res.status(400).json({ error: 'Milestone ID is required' });
    }

    const validation = updateMilestoneStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const {
      status,
      actor_address,
      deliverable_hash,
      deliverable_url,
      deliverable_notes,
      revision_note,
    } = validation.data;

    const updatePayload: Record<string, any> = { status };
    if (status === 'submitted') {
      const now = new Date();
      const autoReleaseDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      updatePayload.submitted_at = now.toISOString();
      updatePayload.auto_release_at = autoReleaseDate.toISOString();
      if (deliverable_hash) updatePayload.deliverable_hash = deliverable_hash;
      if (deliverable_url) updatePayload.deliverable_url = deliverable_url;
      if (deliverable_notes) updatePayload.deliverable_notes = deliverable_notes;
    } else if (status === 'in_revision') {
      updatePayload.submitted_at = null;
      updatePayload.auto_release_at = null;
      if (revision_note) updatePayload.revision_note = revision_note;
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
            message: `Milestone '${updated.title}' for project '${projectTitle}' was submitted for review. Deliverable hash: ${deliverable_hash || 'Recorded'}.`,
            link: `/projects?id=${updated.project_id}`,
          });
        } else if (status === 'in_revision' && freelancerAddress) {
          await createNotification({
            recipient_address: freelancerAddress,
            sender_address: actor_address || clientAddress,
            project_id: updated.project_id,
            type: 'revision_requested',
            title: 'Revision Requested on Milestone 🔄',
            message: `A revision was requested for milestone '${updated.title}'. Note: ${revision_note || 'Please review feedback.'}`,
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

export const requestRevision = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Milestone ID is required' });
    }

    const validation = requestRevisionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { revision_note, actor_address } = validation.data;

    const { data: milestone, error: fetchErr } = await supabase
      .from('milestones')
      .select('*, projects:project_id(id, title, client_id, freelancer_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.status !== 'submitted') {
      return res.status(400).json({
        error: `Cannot request revision for milestone in status '${milestone.status}'. Must be 'submitted'.`,
      });
    }

    const currentLimit = milestone.revision_limit ?? 2;
    const currentRemaining =
      milestone.revisions_remaining !== null && milestone.revisions_remaining !== undefined
        ? milestone.revisions_remaining
        : currentLimit;

    if (currentRemaining <= 0) {
      return res.status(400).json({
        error: 'Revision limit exhausted. No further revisions permitted for this milestone.',
      });
    }

    const newRemaining = currentRemaining - 1;

    const { data: updated, error: updateErr } = await supabase
      .from('milestones')
      .update({
        status: 'in_revision',
        revisions_remaining: newRemaining,
        revision_note,
        submitted_at: null,
        auto_release_at: null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      logger.error(`Error updating revision on milestone ${id}:`, updateErr);
      return res.status(500).json({ error: 'Failed to record revision' });
    }

    // Trigger notification
    (async () => {
      try {
        let freelancerAddress = null;
        let clientAddress = null;
        const project = milestone.projects;
        if (project) {
          const userIds = [project.client_id, project.freelancer_id].filter(Boolean);
          if (userIds.length > 0) {
            const { data: users } = await supabase
              .from('users')
              .select('id, stellar_address')
              .in('id', userIds);
            const userMap = Object.fromEntries(users?.map((u: any) => [u.id, u.stellar_address]) || []);
            freelancerAddress = project.freelancer_id ? userMap[project.freelancer_id] : null;
            clientAddress = project.client_id ? userMap[project.client_id] : null;
          }
        }

        if (freelancerAddress) {
          await createNotification({
            recipient_address: freelancerAddress,
            sender_address: actor_address || clientAddress,
            project_id: milestone.project_id,
            type: 'revision_requested',
            title: 'Revision Requested on Milestone 🔄',
            message: `A formal revision was requested for '${milestone.title}'. Revisions remaining: ${newRemaining}. Note: ${revision_note}`,
            link: `/projects?id=${milestone.project_id}`,
          });
        }
      } catch (notifyErr) {
        logger.error('Error sending revision notification:', notifyErr);
      }
    })();

    return res.json({
      message: 'Revision requested successfully',
      milestone: {
        ...updated,
        projects: milestone.projects,
      },
    });
  } catch (err: any) {
    logger.error('Unexpected error requesting revision:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
