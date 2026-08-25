import { z } from 'zod';

export const projectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  custom_category: z.string().optional(),
  budget: z.number().positive('Budget must be greater than 0'),
  deadline: z.string().optional(),
  visibility: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  client_address: z.string().min(1, 'Client wallet address is required'),
  token: z.enum(['USDC', 'EURC', 'XLM', 'PYUSD']).optional().default('USDC'),
  token_address: z.string().optional(),
  yield_enabled: z.boolean().optional().default(false),
  estimated_yield: z.number().optional().default(0),
  blend_pool_address: z.string().optional(),
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

export const proposalSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  freelancer_address: z.string().min(1, 'Freelancer wallet address is required'),
  cover_note: z.string().min(5, 'Cover note must be at least 5 characters'),
  portfolio_url: z.string().url('Invalid portfolio URL').optional().or(z.literal('')),
});

export type ProposalFormData = z.infer<typeof proposalSchema>;

export const updateProposalStatusSchema = z.object({
  status: z.union([z.literal('accepted'), z.literal('denied'), z.literal('pending')]),
});

export type UpdateProposalStatusData = z.infer<typeof updateProposalStatusSchema>;
