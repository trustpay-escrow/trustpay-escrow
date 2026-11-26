'use client';

import React from 'react';
import {
  DEFAULT_MAX_IMPACT_PCT,
  getLiquidityQuote,
  normalizeFeeBps,
} from '@/lib/liquidity-depth';
import { useLiquidityPool, type LiquidityPoolSnapshot } from '@/hooks/useTokenRates';

export interface LiquidityDepthOptimizerProps {
  amount: number;
  sourceToken?: string;
  targetToken?: string;
  pool?: LiquidityPoolSnapshot | null;
  loading?: boolean;
  error?: string | null;
  maxImpactPct?: number;
  className?: string;
}

function formatValue(value: number, digits = 2): string {
  const numeric = Number.isFinite(value) ? value : 0;
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value: number): string {
  const numeric = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function LiquidityDepthOptimizerPanel({
  amount,
  sourceToken = 'USDC',
  targetToken = 'EURC',
  pool = null,
  loading = false,
  error = null,
  maxImpactPct = DEFAULT_MAX_IMPACT_PCT,
  className = '',
}: LiquidityDepthOptimizerProps) {
  const normalizedAmount = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : 0;
  const threshold = Number.isFinite(Number(maxImpactPct)) && Number(maxImpactPct) > 0
    ? Number(maxImpactPct)
    : DEFAULT_MAX_IMPACT_PCT;
  const quote = pool
    ? getLiquidityQuote({ amountIn: normalizedAmount, reserves: pool, maxImpactPct: threshold })
    : null;
  const plan = quote?.tranchePlan ?? null;
  const hasWarning = Boolean(quote && !quote.withinThreshold);
  const reserveTotal = pool ? pool.reserveBase + pool.reserveQuote : 0;
  const baseShare = reserveTotal > 0 && pool ? (pool.reserveBase / reserveTotal) * 100 : 50;
  const impactShare = quote ? Math.min(100, (quote.priceImpactPct / threshold) * 100) : 0;

  return (
    <section
      data-testid="liquidity-depth-optimizer"
      aria-label="Liquidity depth optimizer"
      className={`rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-[#e4e4e7] shadow-lg shadow-black/20 sm:p-5 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white sm:text-base">Liquidity depth optimizer</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Constant-product AMM analysis for large escrow funding
          </p>
        </div>
        <span
          data-testid="liquidity-pair"
          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-sky-300"
        >
          {sourceToken} → {targetToken}
        </span>
      </header>

      {loading && (
        <div
          data-testid="liquidity-loading"
          className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3.5 py-2.5 text-xs text-slate-300"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Reading AMM pool reserves...
        </div>
      )}

      {!loading && !pool && (
        <div
          data-testid="liquidity-unavailable"
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300"
        >
          {error || 'No liquidity pool data is available for this token pair.'}
        </div>
      )}

      {pool && (
        <div className="space-y-4">
          {error && (
            <p data-testid="liquidity-error-note" className="text-xs text-amber-400">
              {error}
            </p>
          )}

          <div data-testid="pool-reserves" className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Pool reserves</span>
              <span data-testid="constant-product" className="font-mono text-[11px] text-slate-500">
                k = {formatCompact(pool.reserveBase * pool.reserveQuote)}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div
                data-testid="reserve-base-bar"
                className="h-full bg-sky-500/80"
                style={{ width: `${baseShare}%` }}
              />
              <div
                data-testid="reserve-quote-bar"
                className="h-full bg-violet-500/80"
                style={{ width: `${100 - baseShare}%` }}
              />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-slate-800/50 px-2.5 py-2">
                <dt className="text-slate-400">{pool.baseToken} reserve</dt>
                <dd data-testid="reserve-base" className="font-mono font-semibold text-sky-300">
                  {formatCompact(pool.reserveBase)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-800/50 px-2.5 py-2">
                <dt className="text-slate-400">{pool.quoteToken} reserve</dt>
                <dd data-testid="reserve-quote" className="font-mono font-semibold text-violet-300">
                  {formatCompact(pool.reserveQuote)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-800/50 px-2.5 py-2">
                <dt className="text-slate-400">Spot price</dt>
                <dd data-testid="spot-price" className="font-mono font-semibold text-white">
                  1 {pool.baseToken} = {formatValue(quote?.spotPrice ?? 0, 4)} {pool.quoteToken}
                </dd>
              </div>
            </dl>
          </div>

          <div data-testid="swap-impact" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Estimated price impact ({formatValue(normalizedAmount, 0)} {sourceToken})</span>
              <strong
                data-testid="price-impact"
                className={`font-mono text-sm ${hasWarning ? 'text-amber-300' : 'text-emerald-300'}`}
              >
                {formatValue(quote?.priceImpactPct ?? 0)}%
              </strong>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full ${hasWarning ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${impactShare}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Warning threshold: {formatValue(threshold)}% · Pool fee: {formatValue(normalizeFeeBps(pool.feeBps) / 100)}%
            </p>
          </div>

          {hasWarning && quote && (
            <div
              data-testid="slippage-warning"
              role="alert"
              className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3.5 text-xs text-amber-200"
            >
              <p className="flex items-center gap-2 font-bold text-amber-300">
                <span aria-hidden="true">⚠️</span>
                Slippage risk detected
              </p>
              <p className="mt-1">
                A single {formatValue(normalizedAmount, 0)} {sourceToken} swap would lose{' '}
                <strong className="font-mono">{formatValue(quote.priceImpactPct)}%</strong> to price impact and
                pool fees, above the <strong className="font-mono">{formatValue(threshold)}%</strong> limit.
              </p>
            </div>
          )}

          {plan && (
            <div
              data-testid="tranche-recommendation"
              className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3.5 text-xs text-sky-100"
            >
              <p className="font-bold text-sky-300">Recommended funding strategy</p>
              <p className="mt-1">
                Split into <strong data-testid="tranche-count" className="font-mono">{plan.trancheCount}</strong> deposits of{' '}
                <strong data-testid="tranche-amount" className="font-mono">
                  {formatValue(plan.amountPerTranche, 0)} {sourceToken}
                </strong>{' '}
                each. Per-tranche impact: <span className="font-mono">{formatValue(plan.priceImpactPct)}%</span>.
              </p>
              <p className="mt-1 text-sky-200/80">
                Saves <strong data-testid="tranche-savings" className="font-mono text-emerald-300">
                  {formatValue(plan.savedTokens, 2)} {targetToken}
                </strong>{' '}
                ({formatValue(plan.savedPct)}%) versus a single swap.
              </p>
              <p data-testid="tranche-assumption-note" className="mt-1 text-[11px] text-sky-200/60">
                Assumes the pool rebalances toward the market price between deposits.
              </p>
              {plan.isCapped && (
                <p data-testid="tranche-cap-note" className="mt-1 text-amber-300/90">
                  This pool is too shallow for {formatValue(threshold)}% impact even at {plan.trancheCount} tranches.
                  Consider another route or a smaller escrow.
                </p>
              )}
            </div>
          )}

          {quote && (
            <div data-testid="net-cost-comparison" className="space-y-1.5 border-t border-slate-800 pt-3 text-xs">
              <p className="font-semibold text-slate-300">Net cost vs. direct stablecoin deposit</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Direct {sourceToken} deposit</span>
                <span data-testid="direct-deposit-value" className="font-mono text-emerald-300">
                  {formatValue(quote.directDepositValue, 0)} {sourceToken}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Single DEX path swap</span>
                <span data-testid="path-swap-value" className="font-mono text-amber-300">
                  {formatValue(quote.pathSwapValue, 0)} {sourceToken} equiv.
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Path swap loss</span>
                <span data-testid="path-swap-cost" className="font-mono text-amber-300">
                  −{formatValue(quote.pathCost, 2)} {sourceToken} ({formatValue(quote.pathCostPct)}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Optimized tranches</span>
                <span data-testid="optimized-value" className="font-mono text-sky-300">
                  {formatValue(quote.optimizedValue, 0)} {sourceToken} equiv. · −{formatValue(quote.optimizedCost, 2)} (
                  {formatValue(quote.optimizedCostPct)}%)
                </span>
              </div>
            </div>
          )}

          {pool.source === 'demo' && (
            <p data-testid="liquidity-demo-note" className="text-[11px] text-slate-500">
              Illustrative pool depth. Configure a pool contract address for live reserve quotes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function LiquidityDepthOptimizer(props: LiquidityDepthOptimizerProps) {
  const injected = props.pool !== undefined;
  const { pool, loading, error } = useLiquidityPool(props.sourceToken || 'USDC', props.targetToken || 'EURC', {
    enabled: !injected,
  });

  return (
    <LiquidityDepthOptimizerPanel
      {...props}
      pool={injected ? props.pool : pool}
      loading={props.loading ?? (!injected && loading)}
      error={props.error ?? (!injected ? error : null)}
    />
  );
}

export default LiquidityDepthOptimizer;
