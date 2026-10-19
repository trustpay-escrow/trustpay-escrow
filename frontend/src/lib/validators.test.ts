import { describe, it, expect } from 'vitest';
import { projectSchema, milestoneSchema, milestoneArraySchema } from './validators';

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
