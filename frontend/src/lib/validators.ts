import { z } from 'zod';

export const projectSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title is too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000, 'Description is too long'),
  category: z.enum(['Development', 'Design', 'Writing', 'Marketing', 'Other'], {
    message: 'Invalid category selected'
  }),
  custom_category: z.string().optional(),
  budget: z.number().positive('Budget must be greater than 0').max(1000000, 'Budget exceeds maximum limit'),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid deadline date',
  }).refine((val) => {
    const selectedDate = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, {
    message: 'Deadline cannot be in the past',
  }),
  visibility: z.enum(['Public', 'Private'], {
    message: 'Visibility must be Public or Private'
  }),
  attachments: z.array(z.any()).optional(),
  client_address: z.string().min(1, 'Client address is required'),
  token: z.enum(['USDC', 'EURC', 'XLM', 'PYUSD']).optional().default('USDC'),
  token_address: z.string().optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const milestoneSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid deadline date',
  }).refine((val) => {
    const selectedDate = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, {
    message: 'Deadline cannot be in the past',
  }),
  milestone_index: z.number().int().nonnegative('Order must be a non-negative integer'),
  revision_limit: z.number().int().nonnegative('Revision limit must be non-negative').default(0),
  deliverable_type: z.string().min(1, 'Deliverable type is required'),
});

export const milestoneArraySchema = z.array(milestoneSchema).min(1, 'At least one milestone is required');
export type MilestoneFormData = z.infer<typeof milestoneSchema>;
