'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  applySlippage,
  DEFAULT_SLIPPAGE,
  fetchPathQuote,
  getPathAsset,
  HIGH_PRICE_IMPACT_PCT,
  SLIPPAGE_OPTIONS,
  type PathQuote,
} from '@/lib/path-payment';
import { HORIZON_URL, swapViaPathPayment } from '@/lib/soroban';

const SOURCE_SYMBOLS = ['XLM', 'EURC'] as const;
const QUOTE_DEBOUNCE_MS = 400;

type QuoteFetcher = (args: { source: string; destination: string; amount: number; signal: AbortSignal }) => Promise<PathQuote | null>;
type SwapExecutor = typeof swapViaPathPayment;

export interface PathPaymentSwapWidgetProps {
  walletAddress: string | null;
  /** Destination token the escrow must be funded in. */
  destinationToken?: string;
  /** Amount of destination token the escrow needs; used to warn when the swap falls short. */
  requiredAmount?: number;
  onSwapComplete?: (result: { txHash: string; received: number; token: string }) => void;
  className?: string;
  /** Injection points for tests. */
  quoteFetcher?: QuoteFetcher;
  swapExecutor?: SwapExecutor;
}

const defaultQuoteFetcher: QuoteFetcher = async ({ source, destination, amount, signal }) => {
  const src = getPathAsset(source);
  const dst = getPathAsset(destination);
  if (!src || !dst) throw new Error(`${source} → ${destination} is not swappable on the Stellar DEX`);
  return fetchPathQuote({ horizonUrl: HORIZON_URL, source: src, destination: dst, sourceAmount: amount, signal });
};

const fmt = (n: number, digits = 4, minDigits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: minDigits, maximumFractionDigits: digits });

export function PathPaymentSwapWidget({
  walletAddress,
  destinationToken = 'USDC',
  requiredAmount,
  onSwapComplete,
  className = '',
  quoteFetcher = defaultQuoteFetcher,
  swapExecutor = swapViaPathPayment,
}: PathPaymentSwapWidgetProps) {
  const [source, setSource] = useState<string>('XLM');
  const [amountInput, setAmountInput] = useState('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [result, setResult] = useState<{ key: string; quote: PathQuote | null; error: string | null } | null>(null);
  const [swapping, setSwapping] = useState(false);

  const amount = Number(amountInput);
  const validAmount = Number.isFinite(amount) && amount > 0;

  const requestKey = validAmount ? `${source}|${destinationToken}|${amount}` : '';

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const next = await quoteFetcher({ source, destination: destinationToken, amount, signal: controller.signal });
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          quote: next,
          error: next ? null : `No route found from ${source} to ${destinationToken} for this amount.`,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          quote: null,
          error: err instanceof Error ? err.message : 'Could not fetch conversion routes',
        });
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, source, destinationToken, amount, quoteFetcher]);

  // Results only count while they match the current inputs; otherwise we're (re)loading.
  const current = result && result.key === requestKey ? result : null;
  const quote = current?.quote ?? null;
  const error = current?.error ?? null;
  const loading = Boolean(requestKey) && !current;

  const minReceived = useMemo(() => (quote ? applySlippage(quote.destinationAmount, slippage) : 0), [quote, slippage]);
  const shortfall = quote && requiredAmount && minReceived < requiredAmount ? requiredAmount - minReceived : 0;
  const highImpact = quote ? quote.priceImpactPct >= HIGH_PRICE_IMPACT_PCT : false;

  const handleSwap = async () => {
    if (!quote || !walletAddress) return;
    const src = getPathAsset(source);
    const dst = getPathAsset(destinationToken);
    if (!src || !dst) return;
    setSwapping(true);
    try {
      const result = await swapExecutor({
        callerAddress: walletAddress,
        sendAsset: src,
        sendAmount: quote.sourceAmount.toFixed(7),
        destAsset: dst,
        destMin: minReceived.toFixed(7),
        path: quote.route.path,
      });
      toast.success(`Swapped ${fmt(quote.sourceAmount)} ${source} for at least ${fmt(minReceived)} ${destinationToken}`);
      onSwapComplete?.({ txHash: result.txHash, received: minReceived, token: destinationToken });
      setAmountInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  return (
    <section
      className={`space-y-4 rounded-2xl border border-[#27272a] bg-[#09090b] p-4 text-white ${className}`}
      aria-label="Swap to fund escrow"
      data-testid="path-swap-widget"
    >
      <header>
        <h3 className="text-sm font-bold">Pay with another asset</h3>
        <p className="text-xs text-[#a1a1aa]">
          Convert XLM or EURC to {destinationToken} on the Stellar DEX, then fund the escrow.
        </p>
      </header>

      <div className="flex gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Pay with"
          className="rounded-lg border border-[#27272a] bg-[#18181b] px-2 py-2 text-sm"
        >
          {SOURCE_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="0.00"
          aria-label="Amount to swap"
          className="min-w-0 flex-1 rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-xs text-[#a1a1aa]">Slippage tolerance</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Slippage tolerance">
          {SLIPPAGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={slippage === opt}
              onClick={() => setSlippage(opt)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                slippage === opt ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-[#27272a] text-[#a1a1aa]'
              }`}
            >
              {opt.toFixed(1)}%
            </button>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-1 text-xs" data-testid="quote-panel">
        {loading && <p className="text-[#a1a1aa]">Finding the best route…</p>}
        {error && (
          <p role="alert" className="text-red-400" data-testid="quote-error">
            {error}
          </p>
        )}
        {quote && !loading && (
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-[#a1a1aa]">You pay</dt>
            <dd className="text-right" data-testid="quote-input">
              {fmt(quote.sourceAmount)} {source}
            </dd>
            <dt className="text-[#a1a1aa]">Estimated receive</dt>
            <dd className="text-right font-semibold" data-testid="quote-output">
              {fmt(quote.destinationAmount)} {destinationToken}
            </dd>
            <dt className="text-[#a1a1aa]">Minimum after slippage</dt>
            <dd className="text-right" data-testid="quote-min">
              {fmt(minReceived)} {destinationToken}
            </dd>
            <dt className="text-[#a1a1aa]">Exchange rate</dt>
            <dd className="text-right" data-testid="quote-rate">
              1 {source} ≈ {fmt(quote.effectiveRate, 6, 6)} {destinationToken}
            </dd>
            <dt className="text-[#a1a1aa]">Price impact</dt>
            <dd className={`text-right ${highImpact ? 'text-amber-400' : ''}`} data-testid="quote-impact">
              {quote.priceImpactPct.toFixed(2)}%
            </dd>
            <dt className="text-[#a1a1aa]">Route</dt>
            <dd className="text-right" data-testid="quote-route">
              {[source, ...quote.route.path.map((p) => p.code), destinationToken].join(' → ')}
            </dd>
          </dl>
        )}
        {highImpact && (
          <p role="alert" className="text-amber-400" data-testid="impact-warning">
            High price impact. Consider a smaller amount.
          </p>
        )}
        {shortfall > 0 && (
          <p role="alert" className="text-amber-400" data-testid="shortfall-warning">
            This swap may leave you {fmt(shortfall)} {destinationToken} short of the {fmt(requiredAmount ?? 0)} needed.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSwap}
        disabled={!quote || loading || swapping || !walletAddress}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold disabled:opacity-40"
      >
        {swapping ? 'Swapping…' : !walletAddress ? 'Connect wallet to swap' : `Swap to ${destinationToken}`}
      </button>
    </section>
  );
}

export default PathPaymentSwapWidget;
