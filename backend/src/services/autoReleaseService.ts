import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { createNotification } from './notificationService.js';

/**
 * Checks for submitted milestones past their 7-day auto-release timelock
 * and automatically approves them in Supabase & notifies relevant parties.
 */
export const checkAndProcessAutoReleases = async (): Promise<void> => {
  try {
    const nowIso = new Date().toISOString();

    // Fetch submitted milestones where auto_release_at <= now
    const { data: expiredMilestones, error } = await supabase
      .from('milestones')
      .select('*, projects(id, title, client_id, freelancer_id, client:users!projects_client_id_fkey(stellar_address), freelancer:users!projects_freelancer_id_fkey(stellar_address))')
      .eq('status', 'submitted')
      .lte('auto_release_at', nowIso);

    if (error) {
      logger.error('Error fetching expired auto-release milestones:', error);
      return;
    }

    if (!expiredMilestones || expiredMilestones.length === 0) {
      return;
    }

    logger.info(`Found ${expiredMilestones.length} milestone(s) ready for auto-release.`);

    for (const milestone of expiredMilestones) {
      try {
        // Mark status as approved
        const { error: updateErr } = await supabase
          .from('milestones')
          .update({ status: 'approved' })
          .eq('id', milestone.id);

        if (updateErr) {
          logger.error(`Failed to auto-release milestone ${milestone.id}:`, updateErr);
          continue;
        }

        logger.info(`Successfully auto-released milestone ${milestone.id} ('${milestone.title}')`);

        const projectTitle = milestone.projects?.title || 'Project';
        const freelancerAddr = milestone.projects?.freelancer?.stellar_address;
        const clientAddr = milestone.projects?.client?.stellar_address;

        // Send notifications
        if (freelancerAddr) {
          await createNotification({
            recipient_address: freelancerAddr,
            sender_address: clientAddr || undefined,
            project_id: milestone.project_id,
            type: 'milestone_approved',
            title: 'Milestone Auto-Released! ⏳💰',
            message: `Milestone '${milestone.title}' for project '${projectTitle}' was automatically released to your wallet after 7 days!`,
            link: `/projects?id=${milestone.project_id}`,
          });
        }

        if (clientAddr) {
          await createNotification({
            recipient_address: clientAddr,
            sender_address: freelancerAddr || undefined,
            project_id: milestone.project_id,
            type: 'milestone_approved',
            title: 'Milestone Timelock Expired',
            message: `Milestone '${milestone.title}' for project '${projectTitle}' was auto-released after the 7-day review period expired.`,
            link: `/projects?id=${milestone.project_id}`,
          });
        }
      } catch (itemErr) {
        logger.error(`Error processing milestone auto-release for ${milestone.id}:`, itemErr);
      }
    }
  } catch (err: any) {
    logger.error('Unexpected error in auto-release service:', err);
  }
};

/**
 * Initializes the background interval worker for auto-release.
 * @param intervalMs Interval in milliseconds (defaults to 5 minutes)
 */
export const startAutoReleaseWorker = (intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout => {
  logger.info(`Starting Auto-Release Timelock worker (checking every ${intervalMs / 1000}s)...`);
  
  // Run once immediately on startup
  checkAndProcessAutoReleases();

  // Schedule periodic execution
  return setInterval(checkAndProcessAutoReleases, intervalMs);
};
