import { useState, useEffect, useCallback } from 'react';

export interface TokenRates {
  XLM: number;
  USDC: number;
  EURC: number;
  PYUSD: number;
}

const DEFAULT_RATES: TokenRates = {
  XLM: 0.1245,
  USDC: 1.0000,
  EURC: 1.0850,
  PYUSD: 1.0000,
};

export function useTokenRates(pollIntervalMs: number = 60000) {
  const [rates, setRates] = useState<TokenRates>(DEFAULT_RATES);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      // In production, integrate with CoinGecko or Stellar Horizon orderbook feed
      // Here we simulate live exchange rate ticks around baseline
      const jitter = (Math.random() - 0.5) * 0.002;
      setRates((prev) => ({
        ...prev,
        XLM: Math.max(0.01, Number((prev.XLM + jitter).toFixed(4))),
      }));
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Failed to refresh token exchange rates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(fetchRates, pollIntervalMs);
    return () => clearInterval(timer);
  }, [fetchRates, pollIntervalMs]);

  return { rates, lastUpdated, loading, refetch: fetchRates };
}
