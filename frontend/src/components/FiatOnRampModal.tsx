'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { HORIZON_URL } from '@/lib/soroban';
import { signChallengeWithFreighter } from '@/lib/sep10-auth';
import {
  authenticateWithAnchor,
  buildMoonPayUrl,
  computeFeeBreakdown,
  fetchAnchorTransaction,
  fetchDepositInfo,
  fetchUsdcBalance,
  isAnchorTxComplete,
  isAnchorTxFailed,
  MONEYGRAM_ANCHOR_DOMAIN,
  MOONPAY_FEE,
  resolveAnchor,
  startInteractiveDeposit,
  waitForUsdcDeposit,
  type FeeSchedule,
  type OnRampProvider,
} from '@/lib/anchor-client';

type Step = 'select' | 'confirm' | 'processing' | 'detecting' | 'done';

export interface FiatOnRampModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
  /** Prefills the amount, e.g. the project's budget shortfall. */
  suggestedAmount?: number;
  /** Fired once USDC is confirmed in the wallet; the caller funds the escrow here. */
  onDepositDetected: (result: { amount: number; provider: OnRampProvider }) => void;
}

const PROVIDERS: Array<{ id: OnRampProvider; title: string; subtitle: string }> = [
  { id: 'moonpay', title: 'Credit / debit card', subtitle: 'Instant USDC purchase via MoonPay' },
  { id: 'moneygram', title: 'Cash or bank', subtitle: 'Deposit through MoneyGram Access (SEP-0024)' },
];

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Mounts the dialog body only while open so every opening starts from a clean state. */
export function FiatOnRampModal(props: FiatOnRampModalProps) {
  if (!props.isOpen) return null;
  return <FiatOnRampDialog {...props} />;
}

function FiatOnRampDialog({ onClose, walletAddress, suggestedAmount, onDepositDetected }: FiatOnRampModalProps) {
  const isOpen = true;
  const [step, setStep] = useState<Step>('select');
  const [provider, setProvider] = useState<OnRampProvider>('moonpay');
  const [amountInput, setAmountInput] = useState(suggestedAmount ? String(Math.ceil(suggestedAmount)) : '');
  const [anchorInfo, setAnchorInfo] = useState<{ fee: FeeSchedule | null; error: string | null } | null>(null);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const baselineRef = useRef<number | null>(null);

  useEscapeKey(() => handleClose(), isOpen);

  const amount = Number(amountInput);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const anchorFee = anchorInfo?.fee ?? null;
  const feeError = anchorInfo?.error ?? null;
  const schedule = provider === 'moonpay' ? MOONPAY_FEE : anchorFee;
  const fees = useMemo(() => (schedule && validAmount ? computeFeeBreakdown(amount, schedule) : null), [schedule, amount, validAmount]);

  // Load the anchor's published fee schedule once, the first time MoneyGram is chosen
  useEffect(() => {
    if (provider !== 'moneygram' || anchorInfo) return;
    let cancelled = false;
    (async () => {
      try {
        const { transferServer } = await resolveAnchor(MONEYGRAM_ANCHOR_DOMAIN);
        const info = await fetchDepositInfo(transferServer);
        if (cancelled) return;
        setAnchorInfo(
          info.enabled
            ? { fee: info.fee, error: null }
            : { fee: null, error: 'This anchor is not accepting USDC deposits right now.' }
        );
      } catch (err) {
        if (!cancelled) {
          setAnchorInfo({ fee: null, error: err instanceof Error ? err.message : 'Could not load anchor fees' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, anchorInfo]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function handleClose() {
    abortRef.current?.abort();
    onClose();
  }

  async function detectDeposit(provider: OnRampProvider) {
    if (!walletAddress) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep('detecting');
    setStatus('Complete your purchase in the window below. We’ll detect your USDC on Stellar automatically.');
    try {
      const baseline =
        baselineRef.current ?? (await fetchUsdcBalance(HORIZON_URL, walletAddress, fetch, controller.signal));
      const received = await waitForUsdcDeposit({
        horizonUrl: HORIZON_URL,
        account: walletAddress,
        baseline,
        signal: controller.signal,
      });
      setStep('done');
      toast.success(`${received} USDC received. Funding your escrow…`);
      onDepositDetected({ amount: received, provider });
    } catch (err) {
      if (controller.signal.aborted) return;
      setStep('confirm');
      toast.error(err instanceof Error ? err.message : 'Could not confirm the deposit');
    }
  }

  async function startMoonPay() {
    if (!walletAddress) return;
    // Snapshot the balance before the user pays so a fast deposit can't be missed.
    baselineRef.current = await fetchUsdcBalance(HORIZON_URL, walletAddress).catch(() => 0);
    setWidgetUrl(buildMoonPayUrl({ walletAddress, amountUsd: amount }));
    await detectDeposit('moonpay');
  }

  async function startAnchor() {
    if (!walletAddress) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setStep('processing');
    setStatus('Authenticating with the anchor…');
    try {
      baselineRef.current = await fetchUsdcBalance(HORIZON_URL, walletAddress).catch(() => 0);
      const endpoints = await resolveAnchor(MONEYGRAM_ANCHOR_DOMAIN);
      const token = await authenticateWithAnchor({
        webAuthEndpoint: endpoints.webAuthEndpoint,
        account: walletAddress,
        signer: signChallengeWithFreighter,
      });
      const deposit = await startInteractiveDeposit({
        transferServer: endpoints.transferServer,
        token,
        account: walletAddress,
        amount,
      });
      setWidgetUrl(deposit.url);
      setStatus('Complete identity verification and payment in the anchor window.');

      // Poll the anchor until it reports a terminal state, then confirm on-chain.
      while (!controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 4000));
        const tx = await fetchAnchorTransaction(endpoints.transferServer, token, deposit.id);
        if (isAnchorTxFailed(tx.status)) throw new Error(tx.message || `Anchor deposit ${tx.status.replace(/_/g, ' ')}`);
        if (isAnchorTxComplete(tx.status)) break;
        setStatus(`Anchor status: ${tx.status.replace(/_/g, ' ')}`);
      }
      if (controller.signal.aborted) return;
      setWidgetUrl(null);
      await detectDeposit('moneygram');
    } catch (err) {
      if (controller.signal.aborted) return;
      setStep('confirm');
      setWidgetUrl(null);
      toast.error(err instanceof Error ? err.message : 'Anchor deposit failed');
    }
  }

  function handleConfirm() {
    if (!validAmount || !fees) return;
    if (provider === 'moonpay') void startMoonPay();
    else void startAnchor();
  }

  const canConfirm = validAmount && !!fees && !!walletAddress && fees.net > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fiat-onramp-title"
      data-testid="fiat-onramp-modal"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#27272a] bg-[#09090b] p-6 text-white">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="fiat-onramp-title" className="text-lg font-bold">
              Add funds with fiat
            </h2>
            <p className="text-xs text-[#a1a1aa]">Buy USDC straight into your wallet, then fund the escrow.</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-[#a1a1aa] hover:text-white">
            ✕
          </button>
        </div>

        {(step === 'select' || step === 'confirm') && (
          <>
            <div className="space-y-2" role="radiogroup" aria-label="Payment method">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={provider === p.id}
                  onClick={() => {
                    setProvider(p.id);
                    setStep('confirm');
                  }}
                  className={`w-full rounded-xl border p-3 text-left ${
                    provider === p.id && step === 'confirm' ? 'border-blue-500 bg-blue-600/10' : 'border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className="text-sm font-semibold">{p.title}</div>
                  <div className="text-xs text-[#a1a1aa]">{p.subtitle}</div>
                </button>
              ))}
            </div>

            {step === 'confirm' && (
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-[#a1a1aa]">
                  Amount (USD)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    aria-label="Fiat amount"
                    className="mt-1 w-full rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </label>

                {feeError && (
                  <p role="alert" className="text-xs text-red-400" data-testid="fee-error">
                    {feeError}
                  </p>
                )}
                {provider === 'moneygram' && !anchorFee && !feeError && (
                  <p className="text-xs text-[#a1a1aa]">Loading anchor fees…</p>
                )}

                {fees && (
                  <dl className="space-y-1 rounded-xl bg-[#18181b] p-3 text-xs" data-testid="fee-breakdown">
                    <div className="flex justify-between">
                      <dt className="text-[#a1a1aa]">You pay</dt>
                      <dd data-testid="fee-amount">{money(fees.amount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#a1a1aa]">
                        Fees{provider === 'moonpay' ? ' (estimate)' : ''}
                      </dt>
                      <dd data-testid="fee-total">−{money(fees.fee)}</dd>
                    </div>
                    <div className="flex justify-between pl-3 text-[#71717a]">
                      <dt>
                        {schedule?.percent}% + {money(fees.fixedFee)}
                      </dt>
                      <dd>
                        {money(fees.percentFee)} + {money(fees.fixedFee)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-[#27272a] pt-1 font-semibold">
                      <dt>You receive (≈ USDC)</dt>
                      <dd data-testid="fee-net">{fees.net.toFixed(2)}</dd>
                    </div>
                  </dl>
                )}

                {!walletAddress && <p className="text-xs text-amber-400">Connect your wallet to continue.</p>}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold disabled:opacity-40"
                >
                  Confirm and continue
                </button>
              </div>
            )}
          </>
        )}

        {(step === 'processing' || step === 'detecting') && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm" data-testid="onramp-status">
              {status}
            </p>
            {widgetUrl && (
                <iframe
                  src={widgetUrl}
                  title={provider === 'moonpay' ? 'MoonPay checkout' : 'Anchor interactive deposit'}
                  className="h-[480px] w-full rounded-xl border border-[#27272a] bg-white"
                  allow="payment; camera"
                  data-testid="onramp-frame"
                />
            )}
          </div>
        )}

        {step === 'done' && (
          <p className="text-sm text-emerald-400" data-testid="onramp-done">
            USDC received. Your escrow is being funded.
          </p>
        )}
      </div>
    </div>
  );
}

export default FiatOnRampModal;
