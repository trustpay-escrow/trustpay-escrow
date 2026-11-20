import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  decodeSorobanError,
  extractContractErrorCode,
  formatDiagnosticsJson,
  ContractErrorCode,
  KNOWN_CONTRACT_ERRORS,
} from '@/lib/soroban-error-decoder';
import { SorobanErrorToast } from '@/components/SorobanErrorToast';

describe('Soroban Error Decoder & Toast Diagnostic (Issue #143)', () => {
  describe('extractContractErrorCode', () => {
    it('correctly extracts contract code from HostError: Error(Contract, #2)', () => {
      expect(extractContractErrorCode('HostError: Error(Contract, #2)')).toBe(2);
    });

    it('correctly extracts contract code from Error(Contract, #3)', () => {
      expect(extractContractErrorCode('Error(Contract, #3)')).toBe(3);
    });

    it('correctly extracts contract code from contract_error: 8', () => {
      expect(extractContractErrorCode('contract_error: 8')).toBe(8);
    });

    it('returns null for unformatted strings without codes', () => {
      expect(extractContractErrorCode('Random error occurred')).toBeNull();
    });
  });

  describe('decodeSorobanError across all TrustPay contract codes', () => {
    it('maps Code #1 to Unauthorized error explanation', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #1)');
      expect(decoded.code).toBe(ContractErrorCode.Unauthorized);
      expect(decoded.name).toBe('Unauthorized');
      expect(decoded.title).toBe('Authorization Failed');
      expect(decoded.category).toBe('auth');
      expect(decoded.suggestedFix).toContain('Freighter wallet');
    });

    it('maps Code #2 to MilestoneNotPending explanation', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #2)');
      expect(decoded.code).toBe(ContractErrorCode.MilestoneNotPending);
      expect(decoded.title).toBe('Milestone Not Pending');
      expect(decoded.category).toBe('milestone');
    });

    it('maps Code #3 to user-friendly "Milestone is already approved" explanation', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #3)');
      expect(decoded.code).toBe(ContractErrorCode.MilestoneNotSubmitted);
      expect(decoded.title).toBe('Milestone Not Submitted');
      expect(decoded.message).toContain('Milestone is already approved or has not been submitted');
      expect(decoded.category).toBe('milestone');
      expect(decoded.suggestedFix).toContain('freelancer must submit');
    });

    it('maps Code #4 to InvalidState / Project Inactive explanation', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #4)');
      expect(decoded.code).toBe(ContractErrorCode.ProjectNotActive);
      expect(decoded.title).toBe('Project Inactive');
      expect(decoded.category).toBe('state');
    });

    it('maps Code #8 to InsufficientBalance explanation', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #8)');
      expect(decoded.code).toBe(ContractErrorCode.InsufficientBalance);
      expect(decoded.title).toBe('Insufficient Token Balance');
      expect(decoded.category).toBe('balance');
      expect(decoded.suggestedFix).toContain('tokens');
    });

    it('maps all defined codes in KNOWN_CONTRACT_ERRORS without exception', () => {
      Object.keys(KNOWN_CONTRACT_ERRORS).forEach((codeKey) => {
        const num = Number(codeKey);
        const decoded = decodeSorobanError(`Error(Contract, #${num})`);
        expect(decoded.code).toBe(num);
        expect(decoded.title).toBeTruthy();
        expect(decoded.message).toBeTruthy();
        expect(decoded.suggestedFix).toBeTruthy();
      });
    });

    it('handles contract panic string "Milestone not pending" without code prefix', () => {
      const decoded = decodeSorobanError('Contract assertion failed: Milestone not pending');
      expect(decoded.code).toBe(ContractErrorCode.MilestoneNotPending);
      expect(decoded.category).toBe('milestone');
    });

    it('handles Freighter user rejection gracefully', () => {
      const decoded = decodeSorobanError('User declined to sign the transaction');
      expect(decoded.code).toBe('USER_REJECTED');
      expect(decoded.category).toBe('wallet');
      expect(decoded.title).toBe('Transaction Cancelled');
    });

    it('handles Freighter not connected error', () => {
      const decoded = decodeSorobanError('Freighter is not connected');
      expect(decoded.code).toBe('WALLET_DISCONNECTED');
      expect(decoded.category).toBe('wallet');
      expect(decoded.suggestedFix).toContain('freighter.app');
    });

    it('handles Soroban Wasm VM errors', () => {
      const decoded = decodeSorobanError('HostError: Error(WasmVm, ...');
      expect(decoded.code).toBe('HOST_VM_ERROR');
      expect(decoded.category).toBe('rpc');
    });
  });

  describe('formatDiagnosticsJson', () => {
    it('formats error diagnostics for bug reports', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #3)');
      const formatted = formatDiagnosticsJson(decoded);
      const parsed = JSON.parse(formatted);

      expect(parsed.app).toBe('TrustPay Escrow');
      expect(parsed.type).toBe('SOROBAN_TRANSACTION_DIAGNOSTICS');
      expect(parsed.errorCode).toBe(3);
      expect(parsed.friendlyExplanation).toContain('Milestone is already approved');
      expect(parsed.suggestedRemediation).toBeTruthy();
      expect(parsed.rawError).toBe('HostError: Error(Contract, #3)');
    });
  });

  describe('SorobanErrorToast Component', () => {
    it('renders translated friendly title, message, and suggested fix', () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #3)');

      render(<SorobanErrorToast decoded={decoded} toastId="test-toast-1" />);

      // Friendly title
      expect(screen.getByText('Milestone Not Submitted')).toBeDefined();
      // Friendly message
      expect(screen.getByText(/Milestone is already approved/i)).toBeDefined();
      // Suggested fix
      expect(screen.getByText(/Suggested Fix:/i)).toBeDefined();
      // Error code badge
      expect(screen.getByText('Code #3')).toBeDefined();
    });

    it('toggles View Details drawer to reveal raw trace', async () => {
      const rawTrace = 'HostError: Error(Contract, #3) at invokeHostFunction';
      const decoded = decodeSorobanError(rawTrace);

      render(<SorobanErrorToast decoded={decoded} toastId="test-toast-2" />);

      // Initially details drawer should not be present
      expect(screen.queryByTestId('soroban-error-details')).toBeNull();

      // Click "View Details"
      const toggleBtn = screen.getByText('View Details');
      await act(async () => {
        fireEvent.click(toggleBtn);
      });

      // Now details drawer is visible
      const details = screen.getByTestId('soroban-error-details');
      expect(details).toBeDefined();
      expect(screen.getByText(rawTrace)).toBeDefined();
      expect(screen.getByText('Hide Details')).toBeDefined();
    });

    it('renders 1-click Copy Error Diagnostics button and handles click', async () => {
      const decoded = decodeSorobanError('HostError: Error(Contract, #1)');
      const writeTextMock = vi.fn().mockResolvedValue(undefined);

      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<SorobanErrorToast decoded={decoded} toastId="test-toast-3" />);

      const copyBtn = screen.getByLabelText('Copy Error Diagnostics');
      expect(copyBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedContent = JSON.parse(writeTextMock.mock.calls[0][0]);
      expect(copiedContent.errorCode).toBe(1);
      expect(copiedContent.errorName).toBe('Unauthorized');
    });
  });
});

