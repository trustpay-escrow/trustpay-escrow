import { z } from 'zod';

export const step1OverviewSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title is too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000, 'Description is too long'),
  category: z.enum(['Development', 'Design', 'Writing', 'Marketing', 'Other'], {
    message: 'Invalid category selected'
  }),
  custom_category: z.string().optional(),
  visibility: z.enum(['Public', 'Private'], {
    message: 'Visibility must be Public or Private'
  }),
});

export const step2MilestonesSchema = z.object({
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
});

export const step3TokenYieldSchema = z.object({
  token: z.enum(['USDC', 'EURC', 'XLM', 'PYUSD']),
  token_address: z.string().optional(),
  yield_enabled: z.boolean().optional().default(false),
  estimated_yield: z.number().optional().default(0),
  blend_pool_address: z.string().optional(),
});

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
  yield_enabled: z.boolean().optional().default(false),
  estimated_yield: z.number().optional().default(0),
  blend_pool_address: z.string().optional(),
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

export const GITHUB_PR_URL_PATTERN =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)\/?(?:[?#][^\s]*)?$/i;

export interface GitHubPullRequestRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

export interface GitHubPrVerification {
  verified: boolean;
  state?: string;
  title?: string;
  reason?: string;
  unverifiable?: boolean;
}

export function parseGitHubPullRequestUrl(value: string): GitHubPullRequestRef | null {
  if (typeof value !== 'string') return null;
  const match = GITHUB_PR_URL_PATTERN.exec(value.trim());
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
    url: `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`,
  };
}

export function isGitHubPullRequestUrl(value: string): boolean {
  return parseGitHubPullRequestUrl(value) !== null;
}

export const githubPrUrlSchema = z.string().refine(isGitHubPullRequestUrl, {
  message: 'Enter a valid GitHub pull request URL (https://github.com/owner/repo/pull/123)',
});

export async function verifyGitHubPullRequest(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<GitHubPrVerification> {
  const ref = parseGitHubPullRequestUrl(url);
  if (!ref) {
    return { verified: false, reason: 'Enter a valid GitHub pull request URL.' };
  }

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (response.status === 404) {
      return { verified: false, reason: 'Repository or pull request is not accessible.' };
    }
    if (response.status === 403 || response.status === 429) {
      return { verified: false, reason: 'GitHub rate limit reached; accessibility could not be confirmed.', unverifiable: true };
    }
    if (!response.ok) {
      return { verified: false, reason: `GitHub responded with status ${response.status}.`, unverifiable: true };
    }

    const data = (await response.json()) as { number?: number; state?: string; title?: string };
    if (data?.number !== ref.number) {
      return { verified: false, reason: 'GitHub returned a different pull request.', unverifiable: true };
    }
    return { verified: true, state: data.state, title: data.title };
  } catch {
    return { verified: false, reason: 'Could not reach GitHub to verify this link.', unverifiable: true };
  }
}

export const deliverableFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative(),
  type: z.string(),
});

export const deliverableSubmissionSchema = z.object({
  notes: z.string().trim().min(20, 'Add a summary of at least 20 characters'),
  githubPrUrls: z.array(githubPrUrlSchema).max(10, 'At most 10 pull request links are allowed'),
  files: z.array(deliverableFileSchema).max(20, 'At most 20 files are allowed').optional(),
});
