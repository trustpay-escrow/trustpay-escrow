'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

export interface ApplicantCardData {
  id: string;
  project_id?: string;
  stellar_address?: string;
  freelancer_address?: string;
  name?: string;
  pitch?: string;
  cover_note?: string;
  portfolio_url?: string;
  status?: 'pending' | 'accepted' | 'denied' | 'granted' | 'rejected';
  created_at?: string;
  granted?: boolean;
}

export interface ApplicantCardProps {
  applicant: ApplicantCardData;
  onAccept: (id: string) => Promise<void> | void;
  onDeny: (id: string) => Promise<void> | void;
  isProcessing?: boolean;
}

export function ApplicantCard({ applicant, onAccept, onDeny, isProcessing = false }: ApplicantCardProps) {
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<'accept' | 'deny' | null>(null);

  const walletAddr = applicant.stellar_address || applicant.freelancer_address || applicant.name || 'GAUBK...NLSGV';
  const coverText = applicant.cover_note || applicant.pitch || 'No cover note provided.';
  const portfolioUrl = applicant.portfolio_url;
  const currentStatus = applicant.status || (applicant.granted ? 'accepted' : 'pending');

  const handleCopyWallet = () => {
    if (walletAddr) {
      navigator.clipboard.writeText(walletAddr);
      setCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAcceptClick = async () => {
    try {
      setActionLoading('accept');
      await onAccept(applicant.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDenyClick = async () => {
    try {
      setActionLoading('deny');
      await onDeny(applicant.id);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-[#1c1c20]/90 border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl transition-all duration-200">
      
      {/* Top Bar: Wallet Address & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272a]/60">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] block">
            Freelancer Stellar Address
          </span>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs sm:text-sm text-white bg-[#232326] px-3 py-1 rounded-xl border border-[#333338] select-all break-all">
              {walletAddr}
            </span>
            <button
              onClick={handleCopyWallet}
              className="text-[#a1a1aa] hover:text-white transition-colors p-1 text-xs"
              title="Copy Wallet Address"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="self-start sm:self-center">
          {(currentStatus === 'pending') && (
            <span className="px-3 py-1 bg-[#451a03] text-[#f97316] border border-[#78350f] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse"></span>
              Pending Review
            </span>
          )}
          {(currentStatus === 'accepted' || currentStatus === 'granted') && (
            <span className="px-3 py-1 bg-[#052e16] text-[#22c55e] border border-[#14532d] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span>Accepted</span>
              <span>✓</span>
            </span>
          )}
          {(currentStatus === 'denied' || currentStatus === 'rejected') && (
            <span className="px-3 py-1 bg-[#450a0a] text-[#f87171] border border-[#7f1d1d] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span>Denied</span>
              <span>✕</span>
            </span>
          )}
        </div>
      </div>

      {/* Cover Note Section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-bold text-[#e4e4e7] uppercase tracking-wider">
          Cover Note
        </h4>
        <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed whitespace-pre-line bg-[#18181b] p-3.5 rounded-xl border border-[#27272a]">
          &quot;{coverText}&quot;
        </p>
      </div>

      {/* Portfolio Link Section */}
      {portfolioUrl && (
        <div className="space-y-1 pt-1">
          <h4 className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
            Portfolio Link
          </h4>
          <a
            href={portfolioUrl.startsWith('http') ? portfolioUrl : `https://${portfolioUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 transition-all max-w-full truncate"
          >
            <span>🌐</span>
            <span className="truncate">{portfolioUrl}</span>
            <span>↗</span>
          </a>
        </div>
      )}

      {/* Submission Date & Action Buttons Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#27272a]/60">
        {applicant.created_at && (
          <span className="text-[11px] text-[#71717a]">
            Applied on: {new Date(applicant.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Accept / Deny Buttons (Visible when pending) */}
        {currentStatus === 'pending' ? (
          <div className="flex items-center space-x-2.5 self-end sm:self-center">
            <button
              onClick={handleDenyClick}
              disabled={isProcessing || actionLoading !== null}
              className="px-4 py-2 bg-[#450a0a] hover:bg-[#7f1d1d] text-[#f87171] hover:text-white border border-[#7f1d1d] text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1"
            >
              <span>{actionLoading === 'deny' ? 'Denying...' : 'Deny Application'}</span>
              <span>✕</span>
            </button>
            <button
              onClick={handleAcceptClick}
              disabled={isProcessing || actionLoading !== null}
              className="px-5 py-2 bg-[#052e16] hover:bg-[#14532d] text-[#22c55e] hover:text-white border border-[#14532d] text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1"
            >
              <span>{actionLoading === 'accept' ? 'Accepting...' : 'Accept Application'}</span>
              <span>✓</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-[#71717a] italic">
            Application review completed.
          </div>
        )}
      </div>

    </div>
  );
}
