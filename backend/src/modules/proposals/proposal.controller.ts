import { Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import {
  counterOfferSchema,
  proposalSchema,
  updateProposalStatusSchema,
} from '../../shared/utils/validators.js';
import { createNotification } from '../notifications/notification.service.js';

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

    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', project_id)
      .eq('freelancer_address', freelancer_address)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'You have already submitted an application for this project' });
    }

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

    const { status, project_id_onchain } = validationResult.data;

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
          const projectUpdatePayload: Record<string, any> = {
            freelancer_id: freelancerUserId,
            status: 'in_progress',
          };
          if (project_id_onchain !== undefined) {
            projectUpdatePayload.project_id_onchain = project_id_onchain;
          }

          await supabase
            .from('projects')
            .update(projectUpdatePayload)
            .eq('id', updated.project_id);
        }
      }
    }

    logger.info(`Proposal ${id} status updated to ${status}`);

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

/**
 * Two-way proposal counter-offer negotiation (#150).
 *
 * `counter` stores revised terms and notifies the other party, `accept` locks
 * the agreed terms into the project/milestones, and `decline` leaves the
 * original proposal untouched.
 */
export const counterOfferProposal = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    const validation = counterOfferSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { action, milestones, note, actor_address } = validation.data;

    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*, projects:project_id(id, title, budget, client_id, freelancer_id)')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const project = proposal.projects as
      | { id: string; title: string; budget: number; client_id: string | null; freelancer_id: string | null }
      | null;

    let clientAddress: string | null = null;
    let freelancerAddress: string | null = proposal.freelancer_address || null;
    if (project) {
      const userIds = [project.client_id, project.freelancer_id].filter(Boolean);
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, stellar_address')
          .in('id', userIds);
        const addressById = Object.fromEntries(
          (users || []).map((user: any) => [user.id, user.stellar_address])
        );
        clientAddress = project.client_id ? addressById[project.client_id] || null : null;
        freelancerAddress = freelancerAddress || (project.freelancer_id ? addressById[project.freelancer_id] || null : null);
      }
    }

    const actorIsClient = Boolean(
      actor_address &&
        clientAddress &&
        actor_address.toLowerCase() === clientAddress.toLowerCase()
    );
    const proposedBy = actorIsClient ? 'client' : 'freelancer';
    const projectTitle = project?.title || 'the project';

    if (action === 'counter') {
      if (!milestones || milestones.length === 0) {
        return res.status(400).json({ error: 'Counter-offer milestones are required' });
      }

      const counterOffer = {
        proposed_by: proposedBy,
        milestones,
        total: Math.round(
          milestones.reduce((sum, milestone) => sum + Number(milestone.amount), 0) * 100
        ) / 100,
        note: note?.trim() || undefined,
        created_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await supabase
        .from('proposals')
        .update({ counter_offer: counterOffer, negotiation_status: 'countered' })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        logger.error(`Error saving counter-offer for proposal ${id}:`, updateError);
        return res.status(500).json({ error: 'Failed to save counter-offer' });
      }

      const recipient = proposedBy === 'client' ? freelancerAddress : clientAddress;
      if (recipient) {
        await createNotification({
          recipient_address: recipient,
          sender_address: actor_address,
          project_id: proposal.project_id,
          type: 'counter_offer_received',
          title: 'Counter-Offer Received 🤝',
          message: `New terms were proposed for '${projectTitle}': ${counterOffer.total} total. Review and accept, decline, or re-counter.`,
          link: `/projects?id=${proposal.project_id}`,
        }).catch((notifyErr) => logger.error('Counter-offer notification failed:', notifyErr));
      }

      return res.json({ proposal: updated, message: 'Counter-offer sent' });
    }

    const existingCounterOffer = proposal.counter_offer as
      | { proposed_by: string; milestones: any[]; total: number }
      | null;

    if (action === 'accept') {
      if (!existingCounterOffer) {
        return res.status(400).json({ error: 'There is no counter-offer to accept' });
      }

      const { data: updated, error: updateError } = await supabase
        .from('proposals')
        .update({
          status: 'accepted',
          negotiation_status: 'accepted',
          counter_offer: null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        logger.error(`Error accepting counter-offer for proposal ${id}:`, updateError);
        return res.status(500).json({ error: 'Failed to accept counter-offer' });
      }

      if (project) {
        let freelancerUserId = project.freelancer_id;
        if (!freelancerUserId && proposal.freelancer_address) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('stellar_address', proposal.freelancer_address)
            .maybeSingle();
          freelancerUserId = existingUser?.id || null;
          if (!freelancerUserId) {
            const { data: newUser } = await supabase
              .from('users')
              .insert([{ stellar_address: proposal.freelancer_address, role: 'freelancer' }])
              .select('id')
              .single();
            freelancerUserId = newUser?.id || null;
          }
        }

        const projectUpdate: Record<string, any> = {
          budget: existingCounterOffer.total,
          status: 'in_progress',
        };
        if (freelancerUserId) projectUpdate.freelancer_id = freelancerUserId;

        await supabase.from('projects').update(projectUpdate).eq('id', project.id);

        await Promise.all(
          existingCounterOffer.milestones.map((term: any) => {
            const milestoneUpdate: Record<string, any> = { amount: term.amount };
            if (term.title) milestoneUpdate.title = term.title;
            if (term.due_date) milestoneUpdate.due_date = term.due_date;
            return supabase
              .from('milestones')
              .update(milestoneUpdate)
              .eq('project_id', project.id)
              .eq('milestone_index', term.milestone_index);
          })
        );
      }

      const recipient =
        existingCounterOffer.proposed_by === 'client' ? clientAddress : freelancerAddress;
      if (recipient) {
        await createNotification({
          recipient_address: recipient,
          sender_address: actor_address,
          project_id: proposal.project_id,
          type: 'counter_offer_accepted',
          title: 'Counter-Offer Accepted 🎉',
          message: `The revised terms for '${projectTitle}' were accepted and locked into the project.`,
          link: `/projects?id=${proposal.project_id}`,
        }).catch((notifyErr) => logger.error('Counter-offer acceptance notification failed:', notifyErr));
      }

      return res.json({ proposal: updated, message: 'Counter-offer accepted' });
    }

    // decline
    const { data: updated, error: declineError } = await supabase
      .from('proposals')
      .update({ negotiation_status: 'declined' })
      .eq('id', id)
      .select('*')
      .single();

    if (declineError) {
      logger.error(`Error declining counter-offer for proposal ${id}:`, declineError);
      return res.status(500).json({ error: 'Failed to decline counter-offer' });
    }

    const declineRecipient = existingCounterOffer?.proposed_by === 'client'
      ? clientAddress
      : freelancerAddress;
    if (declineRecipient) {
      await createNotification({
        recipient_address: declineRecipient,
        sender_address: actor_address,
        project_id: proposal.project_id,
        type: 'counter_offer_declined',
        title: 'Counter-Offer Declined',
        message: `The revised terms for '${projectTitle}' were declined. The original proposal remains active.`,
        link: `/projects?id=${proposal.project_id}`,
      }).catch((notifyErr) => logger.error('Counter-offer decline notification failed:', notifyErr));
    }

    return res.json({ proposal: updated, message: 'Counter-offer declined' });
  } catch (err: any) {
    logger.error('Unexpected error negotiating counter-offer:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

function portfolioUrlCleaner(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}
