import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { proposalSchema, updateProposalStatusSchema } from '../utils/validators.js';
import { createNotification } from '../services/notificationService.js';

// Create a new proposal / application
export const createProposal = async (req: Request, res: Response): Promise<any> => {
  try {
    const validationResult = proposalSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map(i => `${i.path.join('.') || 'field'}: ${i.message}`)
        .join(' | ');
      logger.warn(`Proposal creation validation failed: ${errorMessages}`);
      return res.status(400).json({ error: `Validation failed: ${errorMessages}` });
    }

    const { project_id, freelancer_address, cover_note, portfolio_url } = validationResult.data;

    // Check if proposal already exists for this project and freelancer address
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', project_id)
      .eq('freelancer_address', freelancer_address)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'You have already submitted an application for this project' });
    }

    // Insert new proposal into database
    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert([
        {
          project_id,
          freelancer_address,
          cover_note,
          portfolio_url: portfolioUrlCleaner(portfolio_url),
          status: 'pending',
        },
      ])
      .select('*')
      .single();

    if (error) {
      logger.error('Error inserting proposal in Supabase:', error);
      return res.status(500).json({ error: 'Failed to submit proposal' });
    }

    logger.info(`Proposal ${proposal.id} created successfully for project ${project_id}`);

    // Notify project owner (Client) about new proposal
    (async () => {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('title, client_id, users(stellar_address)')
          .eq('id', project_id)
          .single();

        const clientAddress = (project as any)?.users?.stellar_address;
        const projectTitle = project?.title || 'your project';

        if (clientAddress) {
          const shortFreelancer = `${freelancer_address.substring(0, 6)}...${freelancer_address.substring(freelancer_address.length - 4)}`;
          await createNotification({
            recipient_address: clientAddress,
            sender_address: freelancer_address,
            project_id: project_id,
            type: 'proposal_received',
            title: 'New Proposal Received',
            message: `Freelancer ${shortFreelancer} submitted a proposal for '${projectTitle}'.`,
            link: `/projects?id=${project_id}`,
          });
        }
      } catch (notifyErr) {
        logger.error('Failed to send proposal notification:', notifyErr);
      }
    })();

    return res.status(201).json({ proposal });
  } catch (err: any) {
    logger.error('Unexpected error creating proposal:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all proposals for a specific project
export const getProposalsByProject = async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID parameter is required' });
    }

    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error fetching proposals for project ${projectId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch proposals' });
    }

    return res.json({ proposals: proposals || [] });
  } catch (err: any) {
    logger.error('Unexpected error fetching proposals by project:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get proposals submitted by a freelancer address
export const getProposalsByFreelancer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { address } = req.params;
    if (!address) {
      return res.status(400).json({ error: 'Freelancer address parameter is required' });
    }

    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('*, projects(title, budget, status)')
      .eq('freelancer_address', address)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error fetching proposals for freelancer ${address}:`, error);
      return res.status(500).json({ error: 'Failed to fetch proposals' });
    }

    return res.json({ proposals: proposals || [] });
  } catch (err: any) {
    logger.error('Unexpected error fetching proposals by freelancer:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update proposal status (accept or deny)
export const updateProposalStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    const validationResult = updateProposalStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid status value. Must be accepted, denied, or pending' });
    }

    const { status } = validationResult.data;

    const { data: updated, error } = await supabase
      .from('proposals')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error(`Error updating proposal ${id} status:`, error);
      return res.status(500).json({ error: 'Failed to update proposal status' });
    }

    // If proposal is accepted, delete all other proposals for this project and assign freelancer
    if (status === 'accepted' && updated?.project_id) {
      const { error: deleteError } = await supabase
        .from('proposals')
        .delete()
        .eq('project_id', updated.project_id)
        .neq('id', id);

      if (deleteError) {
        logger.error(`Error deleting other proposals for project ${updated.project_id}:`, deleteError);
      } else {
        logger.info(`Deleted all other proposals for project ${updated.project_id} after proposal ${id} was accepted`);
      }

      if (updated.freelancer_address) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('stellar_address', updated.freelancer_address)
          .maybeSingle();

        let freelancerUserId = userData?.id;

        if (!freelancerUserId) {
          const { data: newUser } = await supabase
            .from('users')
            .insert([{ stellar_address: updated.freelancer_address, role: 'freelancer' }])
            .select('id')
            .single();
          freelancerUserId = newUser?.id;
        }

        if (freelancerUserId) {
          await supabase
            .from('projects')
            .update({
              freelancer_id: freelancerUserId,
              status: 'in_progress',
            })
            .eq('id', updated.project_id);
        }
      }
    }

    logger.info(`Proposal ${id} status updated to ${status}`);

    // Notify freelancer of proposal decision
    if (updated?.freelancer_address && updated?.project_id) {
      (async () => {
        try {
          const { data: project } = await supabase
            .from('projects')
            .select('title')
            .eq('id', updated.project_id)
            .single();

          const projectTitle = project?.title || 'the project';
          const isAccepted = status === 'accepted';

          await createNotification({
            recipient_address: updated.freelancer_address,
            project_id: updated.project_id,
            type: isAccepted ? 'proposal_accepted' : 'proposal_denied',
            title: isAccepted ? 'Proposal Accepted! 🎉' : 'Proposal Status Update',
            message: isAccepted
              ? `Your proposal for '${projectTitle}' was accepted! You are now assigned to this project.`
              : `Your proposal for '${projectTitle}' was not selected.`,
            link: `/projects?id=${updated.project_id}`,
          });
        } catch (notifyErr) {
          logger.error('Failed to send proposal update notification:', notifyErr);
        }
      })();
    }

    return res.json({ proposal: updated });
  } catch (err: any) {
    logger.error('Unexpected error updating proposal status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

function portfolioUrlCleaner(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}
