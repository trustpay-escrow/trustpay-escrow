'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLiquidityPoolConfig, getLiquidityPoolKey } from '@/config/tokens';
import { DEFAULT_POOL_FEE_BPS } from '@/lib/liquidity-depth';
import { fetchAmmPoolReserves, AmmPoolReserveSnapshot } from '@/lib/soroban';

export interface LiquidityPoolSnapshot {
  baseToken: string;
  quoteToken: string;
  reserveBase: number;
  reserveQuote: number;
  feeBps: number;
  source: 'live' | 'demo';
  fetchedAt: number;
}

export interface UseTokenRatesOptions {
  enabled?: boolean;
  sourceAccount?: string;
}

export interface UseTokenRatesResult {
  pool: LiquidityPoolSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function createDemoPoolSnapshot(
  baseToken: string,
  quoteToken: string,
  feeBps = DEFAULT_POOL_FEE_BPS
): LiquidityPoolSnapshot {
  const baseReserve = baseToken === 'XLM' ? 4_500_000 : 820_000;
  const quoteReserve = quoteToken === 'XLM' ? 4_500_000 : 640_000;
  return {
    baseToken,
    quoteToken,
    reserveBase: baseReserve,
    reserveQuote: quoteReserve,
    feeBps,
    source: 'demo',
    fetchedAt: Date.now(),
  };
}

export function useTokenRates(
  baseToken: string,
  quoteToken: string,
  options: UseTokenRatesOptions = {}
): UseTokenRatesResult {
  const { enabled = true, sourceAccount } = options;
  const [pool, setPool] = useState<LiquidityPoolSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !baseToken || !quoteToken || baseToken === quoteToken) return;

    let active = true;
    const pairKey = getLiquidityPoolKey(baseToken, quoteToken);
    const config = getLiquidityPoolConfig(baseToken, quoteToken);
    const poolFeeBps = config?.feeBps ?? DEFAULT_POOL_FEE_BPS;
    const demoPool = createDemoPoolSnapshot(baseToken, quoteToken, poolFeeBps);

    type LoadResult = { kind: 'demo' } | { kind: 'live'; reserves: AmmPoolReserveSnapshot };
    const load: Promise<LoadResult | null> = Promise.resolve().then(
      (): Promise<LoadResult> | LoadResult | null => {
        if (!active) return null;
        if (!config || !config.contractAddress) return { kind: 'demo' };
        setPool(null);
        setLoading(true);
        setError(null);
        return fetchAmmPoolReserves({
          contractAddress: config.contractAddress,
          sourceAccount,
          reserveDecimals: config.reserveDecimals,
        }).then((reserves): LoadResult => ({ kind: 'live', reserves }));
      }
    );

    load
      .then((result) => {
        if (!active || !result) return;
        if (result.kind === 'demo') {
          setPool(demoPool);
          setLoading(false);
          setError(null);
          return;
        }
        setPool({
          baseToken,
          quoteToken,
          reserveBase: result.reserves.reserveBase,
          reserveQuote: result.reserves.reserveQuote,
          feeBps: poolFeeBps,
          source: 'live',
          fetchedAt: Date.now(),
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPool(demoPool);
        setError(
          `Live reserves unavailable for ${pairKey} (${err instanceof Error ? err.message : String(err)}). Showing illustrative depth.`
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [baseToken, quoteToken, enabled, sourceAccount, reloadKey]);

  const pairActive = enabled && Boolean(baseToken) && Boolean(quoteToken) && baseToken !== quoteToken;
  return {
    pool: pairActive ? pool : null,
    loading: pairActive && loading,
    error: pairActive ? error : null,
    refresh,
  };
}
