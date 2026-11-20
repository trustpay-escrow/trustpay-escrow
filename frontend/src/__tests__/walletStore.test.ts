import { describe, it, expect, beforeEach } from 'vitest';
import {
  canSubmitProposal,
  canCreateProject,
  canApproveMilestone,
  canSubmitMilestone,
  canResolveDispute,
  canRaiseDispute,
  ActiveRole,
} from '@/store/walletStore';

// ──────────────────────────────────────────────────────────────────────────────
// Issue #135: Dynamic Multi-Role Permission Guard & Navigation Switcher
// ──────────────────────────────────────────────────────────────────────────────

describe('walletStore Role Transitions & Permission Selectors (Issue #135)', () => {

  const clientAddress   = 'GCLIENT111111111111111111111111111111111111111111111111111';
  const freelancerAddr  = 'GFREELANCER22222222222222222222222222222222222222222222222';
  const arbiterAddress  = 'GARBITER3333333333333333333333333333333333333333333333333';

  const mockProject = {
    id: 'proj-abc',
    client_address: clientAddress,
    freelancer_address: freelancerAddr,
    arbiter_address: arbiterAddress,
  };

  // ── canSubmitProposal ───────────────────────────────────────────────────────

  describe('canSubmitProposal', () => {
    it('allows a freelancer to apply to a project they did not create', () => {
      const result = canSubmitProposal(mockProject, freelancerAddr, 'freelancer');
      expect(result.allowed).toBe(true);
    });

    it('PREVENTS a client from submitting a proposal to their own escrow', () => {
      const result = canSubmitProposal(mockProject, clientAddress, 'freelancer');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('own escrow project');
    });

    it('PREVENTS submission when wallet is not in Freelancer role', () => {
      const result = canSubmitProposal(mockProject, freelancerAddr, 'client');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Freelancer mode');
    });

    it('PREVENTS submission when wallet is Arbiter role', () => {
      const result = canSubmitProposal(mockProject, freelancerAddr, 'arbiter');
      expect(result.allowed).toBe(false);
    });

    it('PREVENTS submission when no wallet is connected', () => {
      const result = canSubmitProposal(mockProject, null, 'freelancer');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('connect your Freighter wallet');
    });

    it('PREVENTS submission with null project', () => {
      const result = canSubmitProposal(null, freelancerAddr, 'freelancer');
      expect(result.allowed).toBe(false);
    });

    it('handles case-insensitive address comparison for client guard', () => {
      const upperCaseAddress = clientAddress.toUpperCase();
      const projectWithLower = { ...mockProject, client_address: clientAddress.toLowerCase() };
      const result = canSubmitProposal(projectWithLower, upperCaseAddress, 'freelancer');
      expect(result.allowed).toBe(false);
    });
  });

  // ── canCreateProject ────────────────────────────────────────────────────────

  describe('canCreateProject', () => {
    it('allows project creation when in Client role', () => {
      expect(canCreateProject('client')).toBe(true);
    });

    it('PREVENTS project creation when in Freelancer role', () => {
      expect(canCreateProject('freelancer')).toBe(false);
    });

    it('PREVENTS project creation when in Arbiter role', () => {
      expect(canCreateProject('arbiter')).toBe(false);
    });
  });

  // ── canApproveMilestone ─────────────────────────────────────────────────────

  describe('canApproveMilestone', () => {
    it('allows milestone approval when user is project client in Client role', () => {
      expect(canApproveMilestone(mockProject, clientAddress, 'client')).toBe(true);
    });

    it('PREVENTS milestone approval when in Freelancer role', () => {
      expect(canApproveMilestone(mockProject, clientAddress, 'freelancer')).toBe(false);
    });

    it('PREVENTS milestone approval when wallet address does not match client', () => {
      expect(canApproveMilestone(mockProject, freelancerAddr, 'client')).toBe(false);
    });

    it('PREVENTS approval with no wallet connected', () => {
      expect(canApproveMilestone(mockProject, null, 'client')).toBe(false);
    });
  });

  // ── canSubmitMilestone ──────────────────────────────────────────────────────

  describe('canSubmitMilestone', () => {
    it('allows milestone submission when user is project freelancer in Freelancer role', () => {
      const proj = { freelancer_address: freelancerAddr };
      expect(canSubmitMilestone(proj, freelancerAddr, 'freelancer')).toBe(true);
    });

    it('PREVENTS milestone submission when in Client role', () => {
      const proj = { freelancer_address: freelancerAddr };
      expect(canSubmitMilestone(proj, freelancerAddr, 'client')).toBe(false);
    });

    it('PREVENTS milestone submission when user is not the assigned freelancer', () => {
      const proj = { freelancer_address: freelancerAddr };
      expect(canSubmitMilestone(proj, clientAddress, 'freelancer')).toBe(false);
    });
  });

  // ── canResolveDispute ───────────────────────────────────────────────────────

  describe('canResolveDispute', () => {
    it('allows dispute resolution when user is arbiter in Arbiter role', () => {
      const proj = { arbiter_address: arbiterAddress };
      expect(canResolveDispute(proj, arbiterAddress, 'arbiter')).toBe(true);
    });

    it('PREVENTS dispute resolution when not in Arbiter role', () => {
      const proj = { arbiter_address: arbiterAddress };
      expect(canResolveDispute(proj, arbiterAddress, 'client')).toBe(false);
      expect(canResolveDispute(proj, arbiterAddress, 'freelancer')).toBe(false);
    });

    it('PREVENTS resolution when wallet does not match assigned arbiter', () => {
      const proj = { arbiter_address: arbiterAddress };
      expect(canResolveDispute(proj, clientAddress, 'arbiter')).toBe(false);
    });

    it('PREVENTS resolution with no wallet connected', () => {
      expect(canResolveDispute(mockProject, null, 'arbiter')).toBe(false);
    });
  });

  // ── canRaiseDispute ─────────────────────────────────────────────────────────

  describe('canRaiseDispute', () => {
    it('allows client to raise a dispute on their project', () => {
      expect(canRaiseDispute(mockProject, clientAddress)).toBe(true);
    });

    it('allows freelancer to raise a dispute on their project', () => {
      expect(canRaiseDispute(mockProject, freelancerAddr)).toBe(true);
    });

    it('PREVENTS arbiter from raising a dispute', () => {
      expect(canRaiseDispute(mockProject, arbiterAddress)).toBe(false);
    });

    it('PREVENTS a random third party from raising a dispute', () => {
      const thirdParty = 'GUNKNOWN999999999999999999999999999999999999999999999999';
      expect(canRaiseDispute(mockProject, thirdParty)).toBe(false);
    });

    it('PREVENTS raising dispute with null wallet', () => {
      expect(canRaiseDispute(mockProject, null)).toBe(false);
    });
  });

});
