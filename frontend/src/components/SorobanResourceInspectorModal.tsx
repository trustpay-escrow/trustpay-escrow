'use client';

import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWalletStore } from '@/store/walletStore';
import {
  simulateSorobanTransaction,
  SorobanResourceFootprint,
  RESOURCE_THRESHOLDS,
  getResourceUtilization,
  getResourceLevelClass,
  formatResourceValue,
} from '@/lib/soroban';
import { toast } from 'sonner';
import { xdr } from '@stellar/stellar-sdk';

interface TransactionToInspect {
  contractAddress: string;
  functionName: string;
  args: xdr.ScVal[];
  description: string;
}

interface SorobanResourceInspectorModalProps {
  /** The transaction to inspect (if null, modal is closed) */
  transaction: TransactionToInspect | null;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback when user decides to proceed with signing after inspection */
  onProceed?: (footprint: SorobanResourceFootprint) => void;
}

const RESOURCE_METERS = [
  {
    key: 'cpuInstructions',
    label: 'CPU Instructions',
    unit: 'instructions',
    threshold: RESOURCE_THRESHOLDS.CPU,
    icon: '⚙️',
    description: 'Computational complexity of the transaction',
  },
  {
    key: 'memoryBytes',
    label: 'Memory Usage',
    unit: 'bytes',
    threshold: RESOURCE_THRESHOLDS.MEMORY,
    icon: '🧠',
    description: 'Peak RAM footprint during execution',
  },
  {
    key: 'rentBytes',
    label: 'Storage Rent',
    unit: 'bytes',
    threshold: RESOURCE_THRESHOLDS.RENT,
    icon: '💾',
    description: 'Persistent ledger storage TTL rent',
  },
] as const;

export function SorobanResourceInspectorModal({
  transaction,
  onClose,
  onProceed,
}: SorobanResourceInspectorModalProps) {
  const { address } = useWalletStore();
  const [footprint, setFootprint] = useState<SorobanResourceFootprint | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep the modal mounted while a simulation is in flight, but never let
  // Escape dismiss it mid-flight — the callback itself guards on `simulating`.
  useEscapeKey(
    () => {
      if (simulating) return;
      onClose();
    },
    Boolean(transaction)
  );

  useEffect(() => {
    if (!transaction) return;
    let cancelled = false;
    setFootprint(null);
    setCopied(false);
    setSimulating(true);

    simulateSorobanTransaction({
      contractAddress: transaction.contractAddress,
      functionName: transaction.functionName,
      args: transaction.args,
      sourceAccount: address || '',
    })
      .then((result) => {
        if (cancelled) return;
        setFootprint(result);
        setSimulating(false);
        if (!result.success) toast.error(result.error || 'Soroban simulation failed');
      })
      .catch((error: any) => {
        if (cancelled) return;
        setSimulating(false);
        setFootprint({
          cpuInstructions: 0,
          memoryBytes: 0,
          rentBytes: 0,
          estimatedFeeStroops: '0',
          success: false,
          error: error?.message ?? String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [transaction, address]);

  if (!transaction) return null;

  const copyRaw = async () => {
    try {
      const text = footprint?.rawResult
        ? JSON.stringify(footprint.rawResult, null, 2)
        : 'No simulation data available';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Simulation diagnostics copied');
    } catch {
      toast.error('Could not copy diagnostics');
    }
  };

  const warnings = footprint?.success
    ? RESOURCE_METERS.flatMap((meter) => {
        const value = footprint[meter.key as keyof SorobanResourceFootprint] as number;
        const { level, percentage } = getResourceUtilization(value, meter.threshold);
        if (level === 'safe') return [];
        const messages: Record<(typeof meter.key), string> = {
          cpuInstructions: `CPU usage near limit (${percentage}% of max)`,
          memoryBytes: `High memory usage (${percentage}% of max)`,
          rentBytes: `High storage rent usage (${percentage}% of max)`,
        };
        return [{ key: meter.key, text: messages[meter.key] }];
      })
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#27272a] bg-[#18181d] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#27272a]">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>🔬</span> Soroban Resource Inspector
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Pre-flight simulation — no transaction is signed or submitted
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={simulating}
            className="text-slate-400 hover:text-white disabled:opacity-40 text-xl leading-none px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Transaction Info */}
        <div className="p-4 border-b border-[#27272a] bg-slate-950/50">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Action</span>
              <span className="font-medium text-white">{transaction.description}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Contract</span>
              <span className="font-mono text-xs text-indigo-400 truncate max-w-[200px]">{transaction.contractAddress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Function</span>
              <span className="font-mono text-xs text-indigo-400">{transaction.functionName}</span>
            </div>
          </div>
        </div>

        {/* Loading */}
        {simulating && (
          <div className="p-10 flex flex-col items-center justify-center gap-3" role="status">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
            <p className="text-sm font-medium text-white">Running Soroban RPC simulation...</p>
            <p className="text-xs text-slate-400">Fetching CPU, memory &amp; rent footprint</p>
          </div>
        )}

        {/* Error */}
        {!simulating && footprint && !footprint.success && (
          <div className="p-6">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
              <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                <span>⚠️</span> Simulation Failed
              </h3>
              <p className="mt-2 text-xs text-rose-200/80 break-words">
                {footprint.error || 'Unknown simulation error'}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {!simulating && footprint?.success && (
          <div className="p-5 space-y-5">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Estimated Total Fee</p>
                <p className="text-xs text-slate-500 mt-1">Resource fee reported by the Soroban RPC</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-indigo-300">
                  {Number(footprint.estimatedFeeStroops || 0).toLocaleString()} stroops
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {RESOURCE_METERS.map((meter) => {
                const value = footprint[meter.key as keyof SorobanResourceFootprint] as number;
                const { percentage, level } = getResourceUtilization(value, meter.threshold);
                return (
                  <div key={meter.key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{meter.icon}</span>
                        <span className="text-slate-200">{meter.label}</span>
                        <span className="text-xs text-slate-500">— {meter.description}</span>
                      </div>
                      <span className="font-mono text-xs text-white">
                        {formatResourceValue(value)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getResourceLevelClass(level)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {percentage}% of the {meter.unit} limit
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Warnings */}
            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-2">Resource Warnings</h3>
                <ul className="space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning.key} className="text-xs text-amber-200/90">
                      ⚠️ {warning.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                ✅ All resources within safe limits
              </div>
            )}

            {/* Raw diagnostics */}
            <details className="group rounded-lg border border-[#27272a] bg-slate-950/60">
              <summary className="cursor-pointer list-none p-3 text-xs text-slate-400 hover:text-white flex items-center justify-between">
                <span>🔍 Raw XDR &amp; Diagnostic Logs</span>
                <span className="group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="px-3 pb-3">
                <button
                  onClick={copyRaw}
                  className="mb-2 px-2 py-1 rounded text-xs border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  {copied ? '✅ Copied' : '📋 Copy'}
                </button>
                <pre className="max-h-40 overflow-auto rounded bg-black/50 p-2 text-[10px] text-slate-400">
                  {JSON.stringify(footprint.rawResult ?? {}, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={simulating}
            className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
          >
            Close
          </button>
          {footprint?.success && onProceed && (
            <button
              onClick={() => onProceed(footprint)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-400"
            >
              Proceed to Signing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SorobanResourceInspectorModal;
