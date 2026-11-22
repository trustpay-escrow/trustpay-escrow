import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GasFeeEstimatorWidget } from './GasFeeEstimatorWidget';
import type { NetworkFees } from '@/lib/fee-estimator';

const FEES: NetworkFees = {
  baseFee: 100,
  surgeFee: 300,
  minBaseFee: 100,
  capacityUsage: 0.2,
  isSurging: false,
  fetchedAt: 0,
};

const hookState = vi.hoisted(() => ({
  value: { fees: null as NetworkFees | null, loading: false, error: null as string | null, refresh: () => {} },
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => hookState.value,
}));

beforeEach(() => {
  hookState.value = { fees: FEES, loading: false, error: null, refresh: () => {} };
});

describe('GasFeeEstimatorWidget (#256)', () => {
  it('shows the base and surge fee and the three speed presets with ETAs', () => {
    render(<GasFeeEstimatorWidget />);
    expect(screen.getByTestId('gas-base-fee')).toHaveTextContent('100 stroops');
    expect(screen.getByTestId('gas-surge-fee')).toHaveTextContent('300 stroops');
    expect(screen.getByTestId('fee-tier-standard-fee')).toHaveTextContent('100 stroops');
    expect(screen.getByTestId('fee-tier-fast-fee')).toHaveTextContent('150 stroops');
    expect(screen.getByTestId('fee-tier-urgent-fee')).toHaveTextContent('200 stroops');
    const eta = parseFloat(screen.getByTestId('fee-tier-standard-eta').textContent!.replace(/[^\d.]/g, ''));
    expect(eta).toBeLessThan(3);
  });

  it('reports the default preset to the parent on mount', () => {
    const onChange = vi.fn();
    render(<GasFeeEstimatorWidget onChange={onChange} />);
    expect(onChange).toHaveBeenLastCalledWith({ tier: 'standard', multiplier: 1, feeStroops: 100 });
  });

  it('selecting a preset updates the parent transaction parameters', () => {
    const onChange = vi.fn();
    render(<GasFeeEstimatorWidget onChange={onChange} />);

    fireEvent.click(screen.getByTestId('fee-tier-fast'));
    expect(onChange).toHaveBeenLastCalledWith({ tier: 'fast', multiplier: 1.5, feeStroops: 150 });
    expect(screen.getByTestId('fee-tier-fast')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByTestId('fee-tier-urgent'));
    expect(onChange).toHaveBeenLastCalledWith({ tier: 'urgent', multiplier: 2, feeStroops: 200 });
  });

  it('warns when the network is surging', () => {
    hookState.value = { ...hookState.value, fees: { ...FEES, isSurging: true } };
    render(<GasFeeEstimatorWidget />);
    expect(screen.getByTestId('gas-surge-warning')).toBeInTheDocument();
  });

  it('shows an error when fees cannot be loaded', () => {
    hookState.value = { fees: null, loading: false, error: 'boom', refresh: () => {} };
    render(<GasFeeEstimatorWidget />);
    expect(screen.getByTestId('gas-fee-error')).toHaveTextContent('boom');
  });
});
