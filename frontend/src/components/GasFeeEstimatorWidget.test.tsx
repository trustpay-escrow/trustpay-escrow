import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GasFeeEstimatorWidget,
  stroopsToXlm,
} from './GasFeeEstimatorWidget';
import * as sorobanLib from '@/lib/soroban';

describe('GasFeeEstimatorWidget and Fee Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions', () => {
    it('converts stroops to XLM string properly', () => {
      expect(stroopsToXlm(100)).toBe('0.00001');
      expect(stroopsToXlm(10000000)).toBe('1');
      expect(stroopsToXlm(150)).toBe('0.000015');
      expect(stroopsToXlm(0)).toBe('0');
    });

    it('calculates 3 speed tiers with exact multipliers', () => {
      const tiers = sorobanLib.calculateFeeTiers(200, 1.0);
      expect(tiers.standard.feeStroops).toBe(200);
      expect(tiers.standard.multiplier).toBe(1.0);
      expect(tiers.standard.estimatedTimeSec).toBe(3);

      expect(tiers.fast.feeStroops).toBe(300);
      expect(tiers.fast.multiplier).toBe(1.5);
      expect(tiers.fast.estimatedTimeSec).toBe(2);

      expect(tiers.urgent.feeStroops).toBe(400);
      expect(tiers.urgent.multiplier).toBe(2.0);
      expect(tiers.urgent.estimatedTimeSec).toBe(1);
    });

    it('applies surge pricing multiplier when congestion is present', () => {
      const tiers = sorobanLib.calculateFeeTiers(100, 1.5);
      expect(tiers.standard.feeStroops).toBe(150);
      expect(tiers.fast.feeStroops).toBe(225);
      expect(tiers.urgent.feeStroops).toBe(300);
    });
  });

  describe('GasFeeEstimatorWidget Component', () => {
    it('renders widget title and all three tier buttons', async () => {
      render(<GasFeeEstimatorWidget />);

      expect(screen.getByText('Stellar Gas & Fee Estimator')).toBeInTheDocument();
      expect(screen.getByTestId('fee-tier-btn-standard')).toBeInTheDocument();
      expect(screen.getByTestId('fee-tier-btn-fast')).toBeInTheDocument();
      expect(screen.getByTestId('fee-tier-btn-urgent')).toBeInTheDocument();
      expect(screen.getByTestId('selected-fee-summary')).toBeInTheDocument();
    });

    it('toggles active tier and calls onFeeSelected callback when tier is clicked', async () => {
      const onFeeSelected = vi.fn();
      render(<GasFeeEstimatorWidget initialTier="standard" onFeeSelected={onFeeSelected} />);

      const fastBtn = screen.getByTestId('fee-tier-btn-fast');
      fireEvent.click(fastBtn);

      expect(fastBtn).toHaveAttribute('aria-pressed', 'true');
      expect(onFeeSelected).toHaveBeenCalledWith(expect.any(Number), 'fast');

      const urgentBtn = screen.getByTestId('fee-tier-btn-urgent');
      fireEvent.click(urgentBtn);

      expect(urgentBtn).toHaveAttribute('aria-pressed', 'true');
      expect(onFeeSelected).toHaveBeenCalledWith(expect.any(Number), 'urgent');
    });

    it('renders surge warning banner when surge pricing is active', async () => {
      vi.spyOn(sorobanLib, 'fetchStellarFeeStats').mockResolvedValueOnce({
        baseFeeStroops: 200,
        surgeMultiplier: 1.4,
        isSurgeActive: true,
        ledgerCapacityUsage: 0.92,
        tiers: sorobanLib.calculateFeeTiers(200, 1.4),
      });

      render(<GasFeeEstimatorWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('surge-warning-banner')).toBeInTheDocument();
        expect(screen.getByText(/Ledger congestion detected/i)).toBeInTheDocument();
      });
    });

    it('invokes fetchStellarFeeStats when refresh button is clicked', async () => {
      const spy = vi.spyOn(sorobanLib, 'fetchStellarFeeStats');
      render(<GasFeeEstimatorWidget />);

      const refreshBtn = screen.getByTestId('refresh-fees-btn');
      fireEvent.click(refreshBtn);

      expect(spy).toHaveBeenCalled();
    });
  });
});
