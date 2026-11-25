'use client';

import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWalletStore } from '@/store/walletStore';
import { buildFeeBumpTransaction, submitFeeBumpTransaction, TxStatusCallback } from '@/lib/soroban';
import { toast } from 'sonner';

interface StalledTransaction {
  id: string;
  /** Original transaction XDR (base64) */
  innerTxXdr: string;
  /** Description of what this transaction does */
  description: string;
  /** When this transaction was submitted */
  submittedAt: string;
  /** Current stage if known */
  stage?: string;
  /** Project ID for context */
  projectId?: string;
  /** Milestone index if applicable */
  milestoneIndex?: number;
}

type FeeMultiplier = 1.5 | 2 | 3;

const FEE_MULTIPLIERS: { value: FeeMultiplier; label: string; description: string; color: string }[] = [
  { value: 1.5, label: 'Standard (1.5x)', description: '~30-60s confirmation', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 2, label: 'Fast (2x)', description: '~15-30s confirmation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 3, label: 'Urgent (3x)', description: '~5-15s confirmation', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
];

interface TransactionSpeedUpModalProps {
  /** The stalled transaction to speed up */
  stalledTx: StalledTransaction | null;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback when fee bump succeeds */
  onSuccess?: (newTxHash: string) => void;
}

export function TransactionSpeedUpModal({
  stalledTx,
  onClose,
  onSuccess,
}: TransactionSpeedUpModalProps) {
  const { address } = useWalletStore();
  const [selectedMultiplier, setSelectedMultiplier] = useState<FeeMultiplier>(2);
  const [txStage, setTxStage] = useState<'idle' | 'building' | 'signing' | 'submitting' | 'polling' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feeBumpTxXdr, setFeeBumpTxXdr] = useState<string | null>(null);
  const [newFee, setNewFee] = useState<string | null>(null);

  useEscapeKey(() => {
    if (txStage === 'idle' || txStage === 'success' || txStage === 'error') {
      onClose();
    }
  }, Boolean(stalledTx));

  const handleSpeedUp = async () => {
    if (!stalledTx || !address) {
      toast.error('Please connect your wallet first.');
      return;
    }

    setTxStage('building');
    setTxMessage('Building fee-bump transaction...');
    setError(null);

    try {
      // Build the fee-bump transaction
      const result = await buildFeeBumpTransaction({
        innerTxXdr: stalledTx.innerTxXdr,
        feeMultiplier: selectedMultiplier,
        feeSourceAddress: address,
      });

      setFeeBumpTxXdr(result.feeBumpTxXdr);
      setNewFee(result.newFee);

      // Sign and submit
      setTxStage('signing');
      setTxMessage('Awaiting signature in Freighter...');

      const submitResult = await submitFeeBumpTransaction({
        feeBumpTxXdr: result.feeBumpTxXdr,
        feeSourceAddress: address,
        onStatusUpdate: (stage, message) => {
          setTxStage(stage);
          setTxMessage(message);
        },
      });

      if (submitResult.success) {
        setTxStage('success');
        setTxMessage(`Fee-bump confirmed! New tx: ${submitResult.txHash.slice(0, 16)}...`);
        toast.success('Transaction accelerated successfully!');
        onSuccess?.(submitResult.txHash);
      } else {
        throw new Error('Fee-bump submission failed');
      }
    } catch (err: any) {
      setTxStage('error');
      const msg = err.message || String(err);
      setError(msg);
      setTxMessage(`Failed: ${msg}`);
      toast.error(`Speed up failed: ${msg}`);
    }
  };

  if (!stalledTx) return null;

  const pendingDuration = Math.floor((Date.now() - new Date(stalledTx.submittedAt).getTime()) / 1000);
  const isStalled = pendingDuration > 15;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#18181d] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              ⚡
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Speed Up Transaction</h3>
              <p className="text-xs text-slate-400">Fee-bump to accelerate stalled transaction</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => txStage === 'idle' || txStage === 'success' || txStage === 'error' ? onClose() : null}
            disabled={txStage !== 'idle' && txStage !== 'success' && txStage !== 'error'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Transaction Info */}
        <div className="p-4 border-b border-[#27272a] bg-slate-950/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Action</span>
              <span className="font-medium text-white">{stalledTx.description}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Pending for</span>
              <span className={`font-mono font-medium ${isStalled ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {pendingDuration}s
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Status</span>
              <span className="font-medium text-amber-400">Stalled in mempool</span>
            </div>
          </div>
        </div>

        {/* Fee Multiplier Selection */}
        <div className="p-4 border-b border-[#27272a]">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Select Fee Multiplier</h4>
          <div className="space-y-2" role="radiogroup" aria-label="Fee multiplier">
            {FEE_MULTIPLIERS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedMultiplier === opt.value
                    ? `${opt.color} ring-1 ring-offset-1 ring-offset-[#18181d]`
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="fee-multiplier"
                    value={opt.value}
                    checked={selectedMultiplier === opt.value}
                    onChange={() => setSelectedMultiplier(opt.value)}
                    className="w-4 h-4 accent-rose-500"
                    aria-label={opt.label}
                  />
                  <div>
                    <span className="text-sm font-semibold text-white">{opt.label}</span>
                    <div className="text-[11px] text-slate-400">{opt.description}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {newFee && (
            <div className="mt-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Estimated New Inclusion Fee</div>
              <div className="text-lg font-mono font-bold text-rose-400">{Number(newFee).toLocaleString()} stroops</div>
            </div>
          )}
        </div>

        {/* Action Buttons / Progress */}
        <div className="p-4 space-y-3">
          {txStage === 'idle' && (
            <button
              type="button"
              onClick={handleSpeedUp}
              disabled={!address}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⚡ Speed Up Transaction ({selectedMultiplier}x fee)
            </button>
          )}

          {txStage !== 'idle' && txStage !== 'success' && txStage !== 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                <div>
                  <div className="text-sm font-medium text-white">{txStage.charAt(0).toUpperCase() + txStage.slice(1)}...</div>
                  <div className="text-xs text-slate-400">{txMessage}</div>
                </div>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse" style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {txStage === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">✓</div>
                <div>
                  <div className="text-sm font-bold text-white">Transaction Accelerated!</div>
                  <div className="text-xs text-slate-400">Original transaction should now be processed</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {txStage === 'error' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                {error}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setTxStage('idle'); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionSpeedUpModal;