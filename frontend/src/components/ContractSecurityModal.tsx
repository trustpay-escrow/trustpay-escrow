'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  getContractWasmHash,
  getStellarExplorerUrl,
  DEFAULT_ESCROW_CONTRACT_ID,
  EXPECTED_WASM_SHA256,
  OFFICIAL_CONTRACT_REPO_URL,
} from '@/lib/soroban';

export interface ContractSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId?: string;
}

const SECURITY_CHECKLIST = [
  { label: 'Non-Custodial', detail: 'Funds remain locked in the Soroban contract; neither party nor platform can move them unilaterally.' },
  { label: 'Multi-Sig Compatible', detail: 'Dispute resolution supports 2-of-N arbiter consensus via resolve_dispute_multisig.' },
  { label: 'Blend Lending Audited', detail: 'Yield-enabled escrows route idle principal through the audited Blend liquidity pool.' },
];

export function ContractSecurityModal({ isOpen, onClose, contractId }: ContractSecurityModalProps) {
  const targetContract = contractId || DEFAULT_ESCROW_CONTRACT_ID;
  const [wasmHash, setWasmHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const loading = isOpen && wasmHash === null && error === null;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setWasmHash(null);
        setError(null);
        return getContractWasmHash(targetContract);
      })
      .then((hash) => {
        if (hash && !cancelled) setWasmHash(hash);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to query contract bytecode hash.';
        setError(message);
        toast.error('Could not fetch WASM bytecode hash');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetContract]);

  if (!isOpen) return null;

  const verified = Boolean(wasmHash && EXPECTED_WASM_SHA256 && wasmHash === EXPECTED_WASM_SHA256);
  const hashMismatch = Boolean(wasmHash && EXPECTED_WASM_SHA256 && wasmHash !== EXPECTED_WASM_SHA256);

  const handleCopy = async () => {
    if (!wasmHash) return;
    try {
      await navigator.clipboard.writeText(wasmHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Contract Transparency</span>
          <h3 className="text-xl font-bold text-white mt-1">Soroban Escrow Security Inspector</h3>
          <p className="text-xs text-slate-400 mt-1">
            Verifies the deployed WASM bytecode hash against the official audited release build.
          </p>
        </div>

        {/* Deployed WASM Bytecode Hash */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Deployed WASM Bytecode Hash (SHA-256)</span>
            {wasmHash && (
              <button
                onClick={handleCopy}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Querying Soroban RPC for contract instance...
            </div>
          ) : error ? (
            <p className="text-xs text-red-400 break-all">{error}</p>
          ) : wasmHash ? (
            <p className="text-[11px] text-emerald-300 font-mono break-all leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              {wasmHash}
            </p>
          ) : null}

          {wasmHash && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">Contract Instance</span>
              <a
                href={getStellarExplorerUrl(targetContract, 'contract')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                View on Stellar.Expert ↗
              </a>
            </div>
          )}
        </div>

        {/* Verification Status */}
        {wasmHash && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
              verified
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : hashMismatch
                ? 'bg-red-950/40 border-red-500/30 text-red-300'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}
          >
            <span className="text-base leading-none">{verified ? '✓' : hashMismatch ? '✕' : '⚠'}</span>
            <div>
              <p className="font-bold">
                {verified
                  ? 'Bytecode Verified — matches official release artifact'
                  : hashMismatch
                  ? 'Hash Mismatch — deployed bytecode differs from the official build'
                  : 'Unverified — no official release hash configured'}
              </p>
              <p className="mt-0.5 opacity-80">
                {verified
                  ? 'The deployed contract matches the audited open-source build.'
                  : hashMismatch
                  ? 'Do not deposit funds until the deployed contract is reconciled with the audited source.'
                  : 'Set NEXT_PUBLIC_ESCROW_WASM_SHA256 to enable automated release comparison.'}
              </p>
            </div>
          </div>
        )}

        {/* Security Checklist */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Security Checklist</h4>
          {SECURITY_CHECKLIST.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
            >
              <span className="text-emerald-400 font-bold mt-0.5">✓</span>
              <div>
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Verified Source Link */}
        <a
          href={OFFICIAL_CONTRACT_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
        >
          <span>View Verified Rust Source on GitHub</span>
          <span>↗</span>
        </a>

        <div className="flex items-center justify-end pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
