import { Request, Response } from 'express';

import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { milestoneArraySchema } from '../utils/validators.js';

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

// Update a milestone status (e.g. submitted)
export const updateMilestoneStatus = async (req: Request, res: Response) => {
  res.json({ message: `Milestone ${req.params.id} updated` });
};
