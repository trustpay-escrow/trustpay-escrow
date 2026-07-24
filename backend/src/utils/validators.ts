import { z } from 'zod';

export const projectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  custom_category: z.string().optional(),
  budget: z.number().positive('Budget must be greater than 0'),
  deadline: z.string().optional(),
  visibility: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  client_address: z.string().min(1, 'Client wallet address is required'),
  milestones: z.array(z.any()).optional()
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const milestoneSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(150, 'Title is too long'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  due_date: z.string().optional(),
  milestone_index: z.number().int().nonnegative('Order must be a non-negative integer').optional(),
  revision_limit: z.number().int().nonnegative('Revision limit must be non-negative').optional().default(0),
  deliverable_type: z.string().optional(),
});

export const milestoneArraySchema = z.array(milestoneSchema);
export type MilestoneFormData = z.infer<typeof milestoneSchema>;
