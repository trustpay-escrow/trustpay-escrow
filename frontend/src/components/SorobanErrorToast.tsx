'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  DecodedSorobanError,
  decodeSorobanError,
  copyDiagnosticsToClipboard,
} from '@/lib/soroban-error-decoder';

export interface SorobanErrorToastProps {
  decoded: DecodedSorobanError;
  toastId: string | number;
}

export function SorobanErrorToast({ decoded, toastId }: SorobanErrorToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyDiagnosticsToClipboard(decoded);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const getCategoryBadge = () => {
    switch (decoded.category) {
      case 'auth':
        return { label: 'Auth Required', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'milestone':
        return { label: 'Milestone Error', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'balance':
        return { label: 'Balance Issue', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'wallet':
        return { label: 'Wallet Prompt', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'rpc':
        return { label: 'Network/RPC', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
      default:
        return { label: 'Contract Error', color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };
    }
  };

  const badge = getCategoryBadge();

  return (
    <div
      data-testid="soroban-error-toast"
      className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-100 font-sans select-text space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight leading-tight">
              {decoded.title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${badge.color}`}
              >
                {badge.label}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Code #{decoded.code}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => toast.dismiss(toastId)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>

      {/* Friendly Explanation */}
      <p className="text-xs text-slate-300 leading-relaxed font-normal">
        {decoded.message}
      </p>

      {/* Suggested Fix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-start gap-2">
        <span className="text-amber-400 text-sm shrink-0">💡</span>
        <div className="text-[11px] text-slate-300 leading-snug">
          <span className="font-semibold text-amber-300">Suggested Fix: </span>
          {decoded.suggestedFix}
        </div>
      </div>

      {/* Action Bar: View Details & Copy Button */}
      <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-800/80">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
        >
          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={handleCopy}
          className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
          aria-label="Copy Error Diagnostics"
        >
          {copied ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                />
              </svg>
              <span>Copy Error Diagnostics</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div
          data-testid="soroban-error-details"
          className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono space-y-2 animate-in fade-in slide-in-from-top-1"
        >
          <div>
            <div className="text-slate-400 font-sans text-[10px] uppercase font-semibold">
              Raw RPC / Contract Trace:
            </div>
            <pre className="mt-1 text-red-300 break-all whitespace-pre-wrap max-h-32 overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-800/80">
              {decoded.rawError}
            </pre>
          </div>

          <div className="text-[10px] text-slate-400 font-sans flex justify-between">
            <span>Timestamp: {new Date(decoded.timestamp).toLocaleTimeString()}</span>
            <span>Category: {decoded.category}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Triggers a custom rich diagnostic toast for any caught Soroban or Freighter transaction error.
 */
export function showSorobanErrorToast(error: any) {
  const decoded = decodeSorobanError(error);

  return toast.custom((t) => <SorobanErrorToast decoded={decoded} toastId={t} />, {
    duration: 8000,
  });
}

