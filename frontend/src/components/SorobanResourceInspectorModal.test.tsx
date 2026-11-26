import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SorobanResourceInspectorModal } from './SorobanResourceInspectorModal';
import {
  simulateSorobanTransaction,
  RESOURCE_THRESHOLDS,
  getResourceUtilization,
  formatResourceValue,
  getResourceLevelClass,
} from '@/lib/soroban';
import { useWalletStore } from '@/store/walletStore';
import { xdr } from '@stellar/stellar-sdk';

vi.mock('@/hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
import { useEscapeKey } from '@/hooks/useEscapeKey';
vi.mock('@/store/walletStore', () => ({ useWalletStore: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/soroban', async () => {
  const actual = await vi.importActual('@/lib/soroban');
  return { ...actual, simulateSorobanTransaction: vi.fn() };
});

const mockTransaction = {
  contractAddress: 'CABC...CONTRACT',
  functionName: 'approve_milestone',
  args: [xdr.ScVal.scvVoid()],
  description: 'Approve & Release Milestone #1',
};

const mockAddress = 'GCALLER12345678901234567890123456789012345678901234';

const okFootprint = {
  cpuInstructions: 10_000_000,
  memoryBytes: 5 * 1024 * 1024,
  rentBytes: 10_000,
  estimatedFeeStroops: '150000',
  success: true,
  rawResult: { simulation: 'data' },
};

describe('SorobanResourceInspectorModal', () => {
  const onClose = vi.fn();
  const onProceed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore as any).mockReturnValue({ address: mockAddress });
  });

  it('renders nothing when transaction is null', () => {
    const { container } = render(
      <SorobanResourceInspectorModal transaction={null} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state while simulating', () => {
    (simulateSorobanTransaction as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(okFootprint), 100))
    );
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    expect(screen.getByText('Running Soroban RPC simulation...')).toBeInTheDocument();
    expect(screen.getByText(/Fetching CPU, memory & rent footprint/)).toBeInTheDocument();
  });

  it('displays simulation results when successful', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue(okFootprint);
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Estimated Total Fee')).toBeInTheDocument();
      expect(screen.getByText(/\d{3}[\.,]\d{3} stroops/)).toBeInTheDocument();
    });
    expect(screen.getByText('CPU Instructions')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Storage Rent')).toBeInTheDocument();
  });

  it('shows error state when simulation fails', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue({
      cpuInstructions: 0,
      memoryBytes: 0,
      rentBytes: 0,
      estimatedFeeStroops: '0',
      success: false,
      error: 'Contract not found',
    });
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Simulation Failed')).toBeInTheDocument();
      expect(screen.getByText('Contract not found')).toBeInTheDocument();
    });
  });

  it('displays resource warnings when usage is high', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue({
      cpuInstructions: 95_000_000,
      memoryBytes: 90 * 1024 * 1024,
      rentBytes: 10_000,
      estimatedFeeStroops: '200000',
      success: true,
      rawResult: {},
    });
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Resource Warnings')).toBeInTheDocument();
      expect(screen.getByText(/CPU usage near limit/)).toBeInTheDocument();
      expect(screen.getByText(/High memory usage/)).toBeInTheDocument();
    });
  });

  it('shows safe message when all resources are within limits', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue(okFootprint);
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/All resources within safe limits/)).toBeInTheDocument();
    });
  });

  it('calls onProceed when "Proceed to Signing" is clicked', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue(okFootprint);
    render(
      <SorobanResourceInspectorModal
        transaction={mockTransaction}
        onClose={onClose}
        onProceed={onProceed}
      />
    );
    const proceed = await screen.findByText('Proceed to Signing');
    fireEvent.click(proceed);
    expect(onProceed).toHaveBeenCalled();
  });

  it('copies raw XDR when copy button is clicked', async () => {
    (simulateSorobanTransaction as any).mockResolvedValue(okFootprint);
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    await screen.findByText('Estimated Total Fee');
    fireEvent.click(screen.getByText(/Raw XDR/));
    fireEvent.click(await screen.findByText('📋 Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('does not close on escape key while simulating', () => {
    (simulateSorobanTransaction as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(okFootprint), 1000))
    );
    render(<SorobanResourceInspectorModal transaction={mockTransaction} onClose={onClose} />);
    expect(useEscapeKey).toHaveBeenCalled();
    // Modal stays mounted (enabled=true) but the callback guards on `simulating`.
    const [cb, enabled] = vi.mocked(useEscapeKey).mock.calls.at(-1)!;
    expect(enabled).toBe(true);
    cb();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Resource utility functions', () => {
  it('formats resource values correctly', () => {
    expect(formatResourceValue(500)).toBe('500 B');
    expect(formatResourceValue(1024)).toBe('1.0 KB');
    expect(formatResourceValue(1024 * 1024)).toBe('1.00 MB');
    expect(formatResourceValue(1024 * 1024 * 50)).toBe('50.00 MB');
  });

  it('calculates utilization correctly', () => {
    const threshold = { warning: 80, critical: 95, max: 100 };
    expect(getResourceUtilization(50, threshold)).toEqual({ percentage: 50, level: 'safe' });
    expect(getResourceUtilization(85, threshold)).toEqual({ percentage: 85, level: 'warning' });
    expect(getResourceUtilization(96, threshold)).toEqual({ percentage: 96, level: 'critical' });
    expect(getResourceUtilization(150, threshold)).toEqual({ percentage: 100, level: 'critical' });
  });

  it('returns correct color classes', () => {
    expect(getResourceLevelClass('safe')).toBe('bg-emerald-500');
    expect(getResourceLevelClass('warning')).toBe('bg-amber-500');
    expect(getResourceLevelClass('critical')).toBe('bg-rose-500');
  });

  it('thresholds are defined correctly', () => {
    expect(RESOURCE_THRESHOLDS.CPU.max).toBe(100_000_000);
    expect(RESOURCE_THRESHOLDS.MEMORY.max).toBe(100 * 1024 * 1024);
    expect(RESOURCE_THRESHOLDS.RENT.max).toBe(100 * 1024 * 1024);
  });
});
