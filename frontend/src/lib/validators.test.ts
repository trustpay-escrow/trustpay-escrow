import { describe, it, expect, vi } from 'vitest';
import {
  projectSchema,
  milestoneSchema,
  milestoneArraySchema,
  parseGitHubPullRequestUrl,
  isGitHubPullRequestUrl,
  verifyGitHubPullRequest,
  deliverableSubmissionSchema,
  proposalSchema,
  deliverableSchema,
  httpsUrlSchema,
  validateProposal,
  validateDeliverable,
} from './validators';

describe('Frontend Form Validators', () => {
  const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

  it('validates correct project form data', () => {
    const validProject = {
      title: 'Soroban Milestone Escrow Application',
      description: 'Comprehensive milestone payment escrow built on Stellar blockchain infrastructure.',
      category: 'Development',
      budget: 2500,
      deadline: futureDate,
      visibility: 'Public',
      client_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGOF2W2GOGC25NC47WG',
      token: 'USDC',
      yield_enabled: true,
      estimated_yield: 12.5,
    };

    const result = projectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });

  it('rejects title shorter than 5 characters', () => {
    const invalidProject = {
      title: 'Esc',
      description: 'Comprehensive milestone payment escrow built on Stellar blockchain infrastructure.',
      category: 'Development',
      budget: 1000,
      deadline: futureDate,
      visibility: 'Public',
      client_address: 'GBRP...',
    };

    const result = projectSchema.safeParse(invalidProject);
    expect(result.success).toBe(false);
  });

  it('validates milestone specification and array requirements', () => {
    const validMilestone = {
      title: 'UI Mockups and Architecture Spec',
      amount: 1000,
      due_date: futureDate,
      milestone_index: 0,
      revision_limit: 2,
      deliverable_type: 'Figma and GitHub Docs',
    };

    expect(milestoneSchema.safeParse(validMilestone).success).toBe(true);
    expect(milestoneArraySchema.safeParse([validMilestone]).success).toBe(true);
    expect(milestoneArraySchema.safeParse([]).success).toBe(false); // At least 1 required
  });
});

describe('HTTPS URL Validation', () => {
  it('accepts valid HTTPS URLs for deliverables and portfolios', () => {
    expect(httpsUrlSchema.safeParse('https://github.com/stellar/soroban').success).toBe(true);
    expect(httpsUrlSchema.safeParse('https://figma.com/@designer/prototype').success).toBe(true);
    expect(httpsUrlSchema.safeParse('https://demo.app.com/preview').success).toBe(true);
  });

  it('rejects non-HTTPS, relative or malformed URLs', () => {
    expect(httpsUrlSchema.safeParse('http://insecure.site').success).toBe(false);
    expect(httpsUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpsUrlSchema.safeParse('/relative/path').success).toBe(false);
    expect(httpsUrlSchema.safeParse('not-a-url').success).toBe(false);
  });
});

describe('Proposal and Deliverable Client-Side Zod Schemas', () => {
  it('validates proposal with >= 20 char cover notes, positive bid, and valid links', () => {
    const validProposal = {
      coverNote: 'I have extensive experience with Rust and Stellar Soroban smart contracts.',
      bidAmount: 1500,
      estimatedDays: 14,
      portfolioLinks: ['https://github.com/freelancer', 'https://figma.com/designs'],
    };
    expect(proposalSchema.safeParse(validProposal).success).toBe(true);
    expect(validateProposal(validProposal)).toEqual({});
  });

  it('rejects proposal cover note shorter than 20 characters', () => {
    const shortProposal = {
      coverNote: 'Too short note',
      bidAmount: 100,
      estimatedDays: 2,
    };
    const res = proposalSchema.safeParse(shortProposal);
    expect(res.success).toBe(false);

    const errors = validateProposal(shortProposal);
    expect(errors.coverNote).toContain('at least 20 characters');
  });

  it('validates deliverable with >= 10 char notes and valid deliverable links', () => {
    const validDeliverable = {
      notes: 'Completed all Soroban contracts and frontend integration.',
      deliverableLinks: ['https://github.com/trustpay-escrow/trustpay-escrow/pull/100'],
    };
    expect(deliverableSchema.safeParse(validDeliverable).success).toBe(true);
    expect(validateDeliverable(validDeliverable)).toEqual({});
  });

  it('rejects deliverable notes shorter than 10 characters', () => {
    const shortDeliverable = {
      notes: 'Done!',
    };
    const res = deliverableSchema.safeParse(shortDeliverable);
    expect(res.success).toBe(false);

    const errors = validateDeliverable(shortDeliverable);
    expect(errors.notes).toContain('at least 10 characters');
  });
});

describe('GitHub pull request URL validation', () => {
  const validUrls = [
    'https://github.com/Abidoyesimze/trustpay-escrow/pull/130',
    'http://github.com/owner/repo-name/pull/42/',
    'https://www.github.com/Owner.Name/repo_name/pull/7?diff=split#files',
    'https://github.com/a/b/pull/1',
  ];

  const invalidUrls = [
    'https://github.com/owner/repo/issues/130',
    'https://github.com/owner/repo/pull',
    'https://github.com/owner/repo/pull/0',
    'https://github.com/owner/repo/pull/abc',
    'https://gitlab.com/owner/repo/pull/130',
    'javascript:alert(1)//github.com/owner/repo/pull/1',
    'https://github.com/owner/repo/pull/12/files',
    '',
  ];

  it('accepts well-formed GitHub pull request URLs', () => {
    for (const url of validUrls) {
      expect(isGitHubPullRequestUrl(url), url).toBe(true);
    }
  });

  it('rejects malformed, non-GitHub, and non-pull URLs', () => {
    for (const url of invalidUrls) {
      expect(isGitHubPullRequestUrl(url), url).toBe(false);
    }
  });

  it('extracts owner, repository, and pull number', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/Abidoyesimze/trustpay-escrow/pull/130')).toEqual({
      owner: 'Abidoyesimze',
      repo: 'trustpay-escrow',
      number: 130,
      url: 'https://github.com/Abidoyesimze/trustpay-escrow/pull/130',
    });
    expect(parseGitHubPullRequestUrl('not a url')).toBeNull();
  });

  it('verifies repository accessibility through the GitHub API', async () => {
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ number: 130, state: 'open', title: 'Add globe' }),
    });
    const result = await verifyGitHubPullRequest('https://github.com/owner/repo/pull/130', okFetch as unknown as typeof fetch);
    expect(result).toMatchObject({ verified: true, state: 'open', title: 'Add globe' });
    expect(okFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/130',
      expect.objectContaining({ headers: expect.any(Object) })
    );

    const missingFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(
      verifyGitHubPullRequest('https://github.com/owner/repo/pull/130', missingFetch as unknown as typeof fetch)
    ).resolves.toMatchObject({ verified: false });

    expect((await verifyGitHubPullRequest('not a url', okFetch as unknown as typeof fetch)).verified).toBe(false);
  });

  it('validates the complete deliverable submission payload', () => {
    const payload = {
      notes: 'Implemented the milestone deliverables with tests and documentation.',
      githubPrUrls: ['https://github.com/owner/repo/pull/42'],
      files: [{ name: 'architecture.png', size: 2048, type: 'image/png' }],
    };
    expect(deliverableSubmissionSchema.safeParse(payload).success).toBe(true);
    expect(
      deliverableSubmissionSchema.safeParse({ ...payload, githubPrUrls: ['https://github.com/owner/repo/issues/1'] }).success
    ).toBe(false);
  });
});
