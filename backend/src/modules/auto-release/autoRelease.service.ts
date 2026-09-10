import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { createNotification } from '../notifications/notification.service.js';

async function enrichMilestonesWithProjects(milestones: any[]): Promise<any[]> {
  if (!milestones || milestones.length === 0) return [];

  const projectIds = [...new Set(milestones.map((m) => m.project_id).filter(Boolean))];
  if (projectIds.length === 0) return milestones;

  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, title, client_id, freelancer_id')
    .in('id', projectIds);

  if (pErr || !projects) {
    logger.error('Error fetching projects for milestones enrichment:', pErr);
    return milestones;
  }

  const userIds = [...new Set(projects.flatMap((p) => [p.client_id, p.freelancer_id]).filter(Boolean))];
  let usersMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, stellar_address')
      .in('id', userIds);

    if (!uErr && users) {
      for (const u of users) {
        usersMap[u.id] = u.stellar_address;
      }
    }
  }

  const projectsMap: Record<string, any> = {};
  for (const proj of projects) {
    projectsMap[proj.id] = {
      ...proj,
      client: proj.client_id ? { stellar_address: usersMap[proj.client_id] } : null,
      freelancer: proj.freelancer_id ? { stellar_address: usersMap[proj.freelancer_id] } : null,
    };
  }

  return milestones.map((m) => ({
    ...m,
    projects: projectsMap[m.project_id] || null,
  }));
}

export const checkAndProcessTimelockReminders = async (): Promise<void> => {
  try {
    const { data: rawMilestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('status', 'submitted')
      .not('submitted_at', 'is', null);

    if (error) {
      if (error.message?.includes('column') || error.message?.includes('does not exist')) {
        logger.warn('Timelock reminder skipped: milestones.submitted_at column missing in Supabase schema.');
      } else {
        logger.error('Error fetching active submitted milestones for reminders:', error);
      }
      return;
    }

    if (!rawMilestones || rawMilestones.length === 0) {
      return;
    }

    const activeMilestones = await enrichMilestonesWithProjects(rawMilestones);

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
        await createNotification({
          recipient_address: clientAddress,
          sender_address: milestone.projects?.freelancer?.stellar_address || undefined,
          project_id: milestone.project_id,
          type: 'milestone_submitted',
          title,
          message,
          link: `/projects?id=${milestone.project_id}`,
        });

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

export const checkAndProcessAutoReleases = async (): Promise<void> => {
  try {
    const nowIso = new Date().toISOString();

    const { data: rawMilestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('status', 'submitted')
      .lte('auto_release_at', nowIso);

    if (error) {
      if (error.message?.includes('column') || error.message?.includes('does not exist')) {
        logger.warn('Auto-release worker skipped: milestones.auto_release_at column missing in Supabase schema.');
      } else {
        logger.error('Error fetching expired auto-release milestones:', error);
      }
      return;
    }

    if (!rawMilestones || rawMilestones.length === 0) {
      return;
    }

    const expiredMilestones = await enrichMilestonesWithProjects(rawMilestones);

    logger.info(`Found ${expiredMilestones.length} milestone(s) ready for auto-release.`);

    for (const milestone of expiredMilestones) {
      try {
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

export const startAutoReleaseWorker = (intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout => {
  logger.info(`Starting Auto-Release Timelock worker & daily reminder checks (every ${intervalMs / 1000}s)...`);
  
  checkAndProcessTimelockReminders();
  checkAndProcessAutoReleases();

  return setInterval(async () => {
    await checkAndProcessTimelockReminders();
    await checkAndProcessAutoReleases();
  }, intervalMs);
};
