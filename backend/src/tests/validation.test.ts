import { describe, it, expect } from 'vitest';
import { projectSchema, milestoneSchema, proposalSchema, updateProposalStatusSchema } from '../shared/utils/validators.js';

describe('Zod Validation Schemas', () => {
  describe('projectSchema', () => {
    it('validates a complete project payload with multi-token & yield attributes', () => {
      const validPayload = {
        title: 'Soroban Escrow Marketplace DApp',
        description: 'Building an open-source decentralized escrow application',
        category: 'Development',
        budget: 1500,
        client_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGOF2W2GOGC25NC47WG',
        token: 'USDC',
        token_address: 'CCW67TSB3SSS423DNE2B2RQLI274W2YQY35J5XEEGBB5AKWODHBB545G',
        yield_enabled: true,
        estimated_yield: 24.5,
      };

      const result = projectSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('USDC');
        expect(result.data.yield_enabled).toBe(true);
      }
    });

    it('rejects a project with empty title or non-positive budget', () => {
      const invalidPayload = {
        title: 'No', // less than 3 chars
        category: 'Development',
        budget: -100, // negative budget
        client_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGOF2W2GOGC25NC47WG',
      };

      const result = projectSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects a project without client wallet address', () => {
      const missingClient = {
        title: 'Valid Project Title',
        category: 'Design',
        budget: 500,
        client_address: '',
      };

      const result = projectSchema.safeParse(missingClient);
      expect(result.success).toBe(false);
    });
  });

  describe('milestoneSchema', () => {
    it('validates a valid milestone specification', () => {
      const validMilestone = {
        title: 'Milestone 1: Smart Contract Deployment',
        amount: 750,
        revision_limit: 2,
        deliverable_type: 'GitHub Repository',
      };

      const result = milestoneSchema.safeParse(validMilestone);
      expect(result.success).toBe(true);
    });

    it('rejects milestone with zero or negative amount', () => {
      const invalidMilestone = {
        title: 'Milestone 1',
        amount: 0,
      };

      const result = milestoneSchema.safeParse(invalidMilestone);
      expect(result.success).toBe(false);
    });
  });

  describe('proposalSchema', () => {
    it('validates freelancer proposal submission', () => {
      const validProposal = {
        project_id: 'proj-123456',
        freelancer_address: 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7',
        cover_note: 'I am an experienced Rust and Soroban smart contract developer.',
        portfolio_url: 'https://github.com/stellar-developer',
      };

      const result = proposalSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
    });

    it('rejects proposal with short cover note', () => {
      const invalidProposal = {
        project_id: 'proj-123',
        freelancer_address: 'GAUBK...',
        cover_note: 'Hi', // less than 5 chars
      };

      const result = proposalSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
    });
  });

  describe('updateProposalStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(updateProposalStatusSchema.safeParse({ status: 'accepted' }).success).toBe(true);
      expect(updateProposalStatusSchema.safeParse({ status: 'denied' }).success).toBe(true);
      expect(updateProposalStatusSchema.safeParse({ status: 'pending' }).success).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(updateProposalStatusSchema.safeParse({ status: 'unknown_status' }).success).toBe(false);
    });
  });
});
