import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { createNotification } from './notificationService.js';

/**
 * Sends daily reminder notifications to clients on Day 3, 4, 5, and 6
 * after milestone submission to ensure both parties stay informed before auto-release.
 */
export const checkAndProcessTimelockReminders = async (): Promise<void> => {
  try {
    const { data: activeMilestones, error } = await supabase
      .from('milestones')
      .select('*, projects(id, title, client_id, freelancer_id, client:users!projects_client_id_fkey(stellar_address), freelancer:users!projects_freelancer_id_fkey(stellar_address))')
      .eq('status', 'submitted')
      .not('submitted_at', 'is', null);

    if (error) {
      logger.error('Error fetching active submitted milestones for reminders:', error);
      return;
    }

    if (!activeMilestones || activeMilestones.length === 0) {
      return;
    }

    const now = Date.now();

    for (const milestone of activeMilestones) {
      const submittedAtMs = new Date(milestone.submitted_at).getTime();
      const daysElapsed = Math.floor((now - submittedAtMs) / (1000 * 60 * 60 * 24));
      const lastReminderDay = milestone.last_reminder_day || 0;
      const clientAddress = milestone.projects?.client?.stellar_address;
      const projectTitle = milestone.projects?.title || 'Project';

      if (!clientAddress) continue;

      let targetReminderDay = 0;
      let title = '';
      let message = '';

      if (daysElapsed >= 6 && lastReminderDay < 6) {
        targetReminderDay = 6;
        title = 'Final Warning: 24 Hours to Auto-Release 🚨';
        message = `Final Warning: Milestone '${milestone.title}' for project '${projectTitle}' will automatically release escrow funds to the freelancer in 24 hours if no action is taken.`;
      } else if (daysElapsed >= 5 && lastReminderDay < 5) {
        targetReminderDay = 5;
        title = 'Urgent Milestone Reminder (2 Days Left) ⚠️';
        message = `Milestone '${milestone.title}' for project '${projectTitle}' was submitted 5 days ago. You have 2 days left to review or request revisions before funds auto-release.`;
      } else if (daysElapsed >= 4 && lastReminderDay < 4) {
        targetReminderDay = 4;
        title = 'Milestone Review Reminder (3 Days Left) ⏳';
        message = `Milestone '${milestone.title}' for project '${projectTitle}' has 3 days remaining before escrow funds are automatically released.`;
      } else if (daysElapsed >= 3 && lastReminderDay < 3) {
        targetReminderDay = 3;
        title = 'Milestone Review Reminder (4 Days Left) ⏳';
        message = `Milestone '${milestone.title}' for project '${projectTitle}' was submitted 3 days ago. You have 4 days remaining to review the work.`;
      }

      if (targetReminderDay > 0) {
        // Send notification
        await createNotification({
          recipient_address: clientAddress,
          sender_address: milestone.projects?.freelancer?.stellar_address || undefined,
          project_id: milestone.project_id,
          type: 'milestone_submitted',
          title,
          message,
          link: `/projects?id=${milestone.project_id}`,
        });

        // Update last_reminder_day
        await supabase
          .from('milestones')
          .update({ last_reminder_day: targetReminderDay })
          .eq('id', milestone.id);

        logger.info(`Sent Day ${targetReminderDay} timelock reminder to client for milestone ${milestone.id}`);
      }
    }
  } catch (err: any) {
    logger.error('Unexpected error in timelock reminder service:', err);
  }
};

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
 * Initializes the background interval worker for auto-release and timelock reminders.
 * @param intervalMs Interval in milliseconds (defaults to 5 minutes)
 */
export const startAutoReleaseWorker = (intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout => {
  logger.info(`Starting Auto-Release Timelock worker & daily reminder checks (every ${intervalMs / 1000}s)...`);
  
  // Run once immediately on startup
  checkAndProcessTimelockReminders();
  checkAndProcessAutoReleases();

  // Schedule periodic execution
  return setInterval(async () => {
    await checkAndProcessTimelockReminders();
    await checkAndProcessAutoReleases();
  }, intervalMs);
};
