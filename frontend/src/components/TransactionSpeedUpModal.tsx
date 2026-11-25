'use client';

import React, { useEffect, useState } from 'react';
import { signTransaction } from '@stellar/freighter-api';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import {
  buildFeeBumpTransaction,
  cancelFeeBumpRequest,
  registerFeeBumpReplacement,
  requestFeeBump,
  SPEED_UP_FEE_PRESETS,
  type PendingSorobanTransaction,
  type SpeedUpMultiplier,
} from '@/lib/transaction-speedup';
import {
  getSorobanRpcServer,
  STELLAR_NETWORK_PASSPHRASE,
} from '@/lib/soroban';

interface TransactionSpeedUpModalProps {
  pendingTransaction: PendingSorobanTransaction;
  feeSource: string;
  onIncluded: (txHash: string) => void;
}

export function TransactionSpeedUpModal({
  pendingTransaction,
  feeSource,
  onIncluded,
}: TransactionSpeedUpModalProps) {
  const [eligible, setEligible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [multiplier, setMultiplier] = useState<SpeedUpMultiplier>(2);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const remaining = Math.max(
      0,
      15_000 - (Date.now() - pendingTransaction.submittedAt)
    );
    const timer = window.setTimeout(() => setEligible(true), remaining);
    return () => window.clearTimeout(timer);
  }, [pendingTransaction.submittedAt]);

  const submitFeeBump = async () => {
    setWorking(true);
    setError('');
    setMessage('Checking whether the original transaction has already confirmed…');

    try {
      const server = getSorobanRpcServer();
      const originalStatus = await server.getTransaction(pendingTransaction.hash);
      if (originalStatus.status === 'SUCCESS') {
        setMessage('The original transaction has already been included in the ledger.');
        onIncluded(pendingTransaction.hash);
        setWorking(false);
        return;
      }
      if (originalStatus.status === 'FAILED') {
        throw new Error('The original transaction failed and cannot be accelerated.');
      }

      const feeBump = buildFeeBumpTransaction(
        pendingTransaction.xdr,
        feeSource,
        multiplier,
        STELLAR_NETWORK_PASSPHRASE
      );
      setMessage('Awaiting wallet signature for the fee-bump transaction…');
      const signedResult = await signTransaction(feeBump.toXDR(), {
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      });

      let signedXdr = '';
      if (typeof signedResult === 'string') {
        signedXdr = signedResult;
      } else if (signedResult && typeof signedResult === 'object') {
        if (signedResult.error) {
          throw new Error(
            typeof signedResult.error === 'string'
              ? signedResult.error
              : signedResult.error.message || 'Wallet rejected the fee-bump signature.'
          );
        }
        signedXdr = signedResult.signedTxXdr || '';
      }
      if (!signedXdr) throw new Error('Wallet did not return a signed fee-bump transaction.');

      setMessage('Submitting the fee-bump transaction to Stellar…');
      const signedFeeBump = TransactionBuilder.fromXDR(
        signedXdr,
        STELLAR_NETWORK_PASSPHRASE
      );
      const submission = await server.sendTransaction(signedFeeBump);
      if (submission.status === 'ERROR') {
        throw new Error(
          `Stellar rejected the fee-bump transaction: ${
            submission.errorResult ? JSON.stringify(submission.errorResult) : submission.status
          }`
        );
      }

      registerFeeBumpReplacement(pendingTransaction.hash, submission.hash);
      setMessage('Fee bump submitted. Waiting for ledger inclusion…');
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const status = await server.getTransaction(submission.hash);
        if (status.status === 'SUCCESS') {
          setMessage('The accelerated transaction is confirmed on Stellar.');
          onIncluded(submission.hash);
          setWorking(false);
          return;
        }
        if (status.status === 'FAILED') {
          throw new Error('The fee-bump transaction failed during ledger execution.');
        }
      }
      setMessage('The fee bump is still pending. Check the transaction explorer for its latest status.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setMessage('');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-800 pt-4 text-left">
      {!eligible ? (
        <p className="text-xs text-slate-500">Speed-up will be available after 15 seconds.</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            requestFeeBump(pendingTransaction.hash);
            setIsOpen(true);
          }}
          className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
        >
          Speed Up Transaction
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="speed-up-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div>
              <h2 id="speed-up-title" className="text-lg font-bold text-white">
                Speed Up Transaction
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                A fee-bump wraps the original signed transaction without repeating its contract call.
              </p>
            </div>
            <fieldset disabled={working} className="grid grid-cols-3 gap-2">
              <legend className="sr-only">Fee multiplier</legend>
              {SPEED_UP_FEE_PRESETS.map((preset) => (
                <label
                  key={preset.label}
                  className={`cursor-pointer rounded-xl border p-3 text-center text-xs transition-colors ${
                    multiplier === preset.multiplier
                      ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="fee-multiplier"
                    value={preset.multiplier}
                    checked={multiplier === preset.multiplier}
                    onChange={() => setMultiplier(preset.multiplier)}
                    className="sr-only"
                  />
                  <span className="block font-bold">{preset.label}</span>
                  <span>{preset.multiplier}x fee</span>
                </label>
              ))}
            </fieldset>

            {message && <p role="status" className="text-xs text-slate-300">{message}</p>}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={working}
                onClick={() => {
                  if (!working) cancelFeeBumpRequest(pendingTransaction.hash);
                  setIsOpen(false);
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={working}
                onClick={submitFeeBump}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {working ? 'Processing…' : 'Sign & Speed Up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
