'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchHorizonFeeStats } from '@/lib/soroban';
import type { NetworkFees } from '@/lib/fee-estimator';

export const NETWORK_STATUS_POLL_MS = 15_000;

export interface UseNetworkStatusResult {
  fees: NetworkFees | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Live Stellar network fee status from Horizon `/fee_stats` (#256).
 * Refreshes every 15 s while mounted; keeps the last good value on failure.
 */
export function useNetworkStatus(
  options: { enabled?: boolean; pollMs?: number } = {}
): UseNetworkStatusResult {
  const { enabled = true, pollMs = NETWORK_STATUS_POLL_MS } = options;
  const [fees, setFees] = useState<NetworkFees | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const load = async () => {
      try {
        const next = await fetchHorizonFeeStats();
        if (!active) return;
        setFees(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load network fees');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, pollMs, reloadKey]);

  return { fees, loading, error, refresh };
}
