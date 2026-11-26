'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CryptoId } from '@/components/ui/CryptoId';
import { AddressBadge } from './AddressBadge';
import { PortfolioLinkPreview } from './PortfolioLinkPreview';
import { ZkAttestationBadge } from './ZkAttestationBadge';
import { EmbeddedDemoSandbox } from './EmbeddedDemoSandbox';
import { ProposalExpirationBadge, formatTimeRemaining } from './ProposalExpirationBadge';
import { TruncatedText } from './TruncatedText';
import { announcePolite } from '@/components/a11y/LiveAnnouncer';
import { CounterOfferSummary } from '@/components/ProposalCounterOfferModal';
import type { CounterOffer } from '@/lib/counter-offer';

export interface ApplicantCardData {
  id: string;
  project_id?: string;
  stellar_address?: string;
  freelancer_address?: string;
  name?: string;
  pitch?: string;
  cover_note?: string;
  portfolio_url?: string;
  demo_url?: string;
  demoUrl?: string;
  status?: 'pending' | 'accepted' | 'denied' | 'granted' | 'rejected' | 'withdrawn';
  created_at?: string;
  expires_at?: string;
  granted?: boolean;
  zk_attestation?: unknown;
  counter_offer?: CounterOffer | null;
  negotiation_status?: 'none' | 'countered' | 'accepted' | 'declined';
}

export interface ApplicantCardProps {
  applicant: ApplicantCardData;
  onAccept: (id: string) => Promise<void> | void;
  onDeny: (id: string) => Promise<void> | void;
  onWithdraw?: (id: string) => Promise<void> | void;
  onOpenChat?: (freelancerAddress: string) => void;
  onOpenProfile?: () => void;
  isProcessing?: boolean;
  /** Whether the client has starred this freelancer (#255). */
  isStarred?: boolean;
  /** When provided, a star toggle is shown on the card. */
  onToggleStar?: (applicant: ApplicantCardData) => void;
  /** Project budget, used as the baseline for an incoming counter-offer diff (#150). */
  projectBudget?: number;
  tokenSymbol?: string;
  /** Opens the counter-offer editor for this applicant (#150). */
  onCounterOffer?: (applicant: ApplicantCardData) => void;
  /** Accepts, declines, or re-counters an incoming counter-offer (#150). */
  onRespondToCounterOffer?: (
    action: 'accept' | 'decline',
    applicant: ApplicantCardData
  ) => void | Promise<void>;
  counterOfferSubmitting?: boolean;
}

export function ApplicantCard({
  applicant,
  onAccept,
  onDeny,
  onWithdraw,
  onOpenChat,
  onOpenProfile,
  isProcessing = false,
  isStarred = false,
  onToggleStar,
  projectBudget,
  tokenSymbol = 'USDC',
  onCounterOffer,
  onRespondToCounterOffer,
  counterOfferSubmitting = false,
}: ApplicantCardProps) {
  const [actionLoading, setActionLoading] = useState<'accept' | 'deny' | 'withdraw' | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  const walletAddr =
    applicant.stellar_address || applicant.freelancer_address || applicant.name || 'GAUBK...NLSGV';
  const coverText = applicant.cover_note || applicant.pitch || 'No cover note provided.';
  const portfolioUrl = applicant.portfolio_url;
  const demoUrl = applicant.demo_url || applicant.demoUrl;
  const currentStatus = applicant.status || (applicant.granted ? 'accepted' : 'pending');
  const prevStatusRef = useRef(currentStatus);

  const isExpired = applicant.expires_at ? formatTimeRemaining(new Date(applicant.expires_at)).isExpired : false;

  const notifyStatus = (message: string) => {
    setStatusAnnouncement(message);
    announcePolite(message);
  };

  useEffect(() => {
    if (prevStatusRef.current !== currentStatus) {
      prevStatusRef.current = currentStatus;
      const msg = `Proposal status updated: ${currentStatus}.`;
      setStatusAnnouncement(msg);
      announcePolite(msg);
    }
  }, [currentStatus]);

  const handleAcceptClick = async () => {
    if (isExpired) {
      const msg = 'Cannot accept an expired proposal.';
      toast.error(msg);
      notifyStatus(msg);
      return;
    }
    try {
      setActionLoading('accept');
      notifyStatus('Accepting proposal...');
      await onAccept(applicant.id);
      notifyStatus('Proposal accepted.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDenyClick = async () => {
    try {
      setActionLoading('deny');
      notifyStatus('Denying proposal...');
      await onDeny(applicant.id);
      notifyStatus('Proposal denied.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawClick = async () => {
    if (!onWithdraw) return;
    try {
      setActionLoading('withdraw');
      notifyStatus('Withdrawing proposal...');
      await onWithdraw(applicant.id);
      toast.success('Proposal withdrawn successfully.');
      notifyStatus('Proposal withdrawn successfully.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-[#1c1c20]/90 border border-[#27272a] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl card-hover-border">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>
      {/* Top Bar: Wallet Address & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272a]/60">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] block">
            Freelancer Stellar Address
          </span>
          <div className="flex items-center space-x-2">
            <CryptoId
              value={walletAddr}
              className="sm:text-sm text-white bg-[#232326] px-3 py-1 rounded-xl border border-[#333338] select-all break-all"
            />
            <AddressBadge address={walletAddr} showExplorerLink={true} />
            <AddressBadge value={walletAddr} label="Copy Wallet Address" />
            {onToggleStar && (
              <button
                type="button"
                onClick={() => onToggleStar(applicant)}
                aria-pressed={isStarred}
                aria-label={isStarred ? 'Remove from saved contractors' : 'Save contractor'}
                title={isStarred ? 'Remove from saved contractors' : 'Save contractor'}
                className={`p-1 text-base transition-colors ${
                  isStarred ? 'text-amber-400 hover:text-amber-300' : 'text-[#71717a] hover:text-amber-300'
                }`}
                data-testid="applicant-star-toggle"
              >
                {isStarred ? '★' : '☆'}
              </button>
            )}
          </div>
          {Boolean(applicant.zk_attestation) && (
            <div className="pt-1">
              <ZkAttestationBadge attestation={applicant.zk_attestation} />
            </div>
          )}
        </div>

        {/* Status Badge & Expiration Countdown */}
        <div className="self-start sm:self-center flex flex-wrap items-center gap-2">
          {applicant.expires_at && (
            <ProposalExpirationBadge expiresAt={applicant.expires_at} />
          )}
          {currentStatus === 'pending' && (
            <span className="px-3 py-1 bg-[#451a03] text-[#f97316] border border-[#78350f] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" aria-hidden="true"></span>
              Pending Review
            </span>
          )}
          {(currentStatus === 'accepted' || currentStatus === 'granted') && (
            <span className="px-3 py-1 bg-[#052e16] text-[#22c55e] border border-[#14532d] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span>Accepted</span>
              <span aria-hidden="true">✓</span>
            </span>
          )}
          {(currentStatus === 'denied' || currentStatus === 'rejected') && (
            <span className="px-3 py-1 bg-[#450a0a] text-[#f87171] border border-[#7f1d1d] text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span>Denied</span>
              <span aria-hidden="true">✕</span>
            </span>
          )}
          {currentStatus === 'withdrawn' && (
            <span className="px-3 py-1 bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold rounded-full inline-flex items-center gap-1.5">
              <span>Withdrawn</span>
            </span>
          )}
        </div>
      </div>

      {/* Cover Note Section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-bold text-[#e4e4e7] uppercase tracking-wider">
          Cover Note
        </h4>
        <div className="bg-[#18181b] p-3.5 rounded-xl border border-[#27272a]">
          <TruncatedText text={coverText} lines={3} />
        </div>
      </div>

      {/* Incoming counter-offer from the freelancer (#150) */}
      {applicant.counter_offer && applicant.negotiation_status === 'countered' && (
        <CounterOfferSummary
          offer={applicant.counter_offer}
          originalBudget={projectBudget}
          tokenSymbol={tokenSymbol}
          isSubmitting={counterOfferSubmitting}
          onAccept={() => {
            if (onRespondToCounterOffer) return onRespondToCounterOffer('accept', applicant);
            return onAccept(applicant.id);
          }}
          onDecline={() => {
            if (onRespondToCounterOffer) return onRespondToCounterOffer('decline', applicant);
            return onDeny(applicant.id);
          }}
          onRecounter={onCounterOffer ? () => onCounterOffer(applicant) : undefined}
        />
      )}

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
            <span aria-hidden="true">🌐</span>
            <span className="truncate">{portfolioUrl}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {/* Live Demo Sandbox Section */}
      {demoUrl && (
        <div className="space-y-1.5 pt-1">
          <h4 className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
            Live Code Demo
          </h4>
          <EmbeddedDemoSandbox url={demoUrl} title="Freelancer live demo" />
        </div>
      )}

      {/* Submission Date & Action Buttons Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#27272a]/60">
        <div className="flex items-center gap-3">
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-3 py-1.5 bg-[#232326] hover:bg-[#27272a] text-[#e4e4e7] border border-[#333338] text-[11px] font-bold rounded-xl transition-colors"
            >
              ZK Profile
            </button>
          )}
          {applicant.created_at && (
            <span className="text-[11px] text-[#71717a]">
              Applied on: {new Date(applicant.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Accept / Deny Buttons (Visible when pending) */}
        {currentStatus === 'pending' ? (
          <div className="flex flex-wrap items-center space-x-2.5 self-end sm:self-center">
            {onCounterOffer && (
              <button
                type="button"
                onClick={() => onCounterOffer(applicant)}
                disabled={isProcessing || actionLoading !== null}
                data-testid="applicant-counter-offer"
                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                ↔ Counter Offer
              </button>
            )}
            {onWithdraw && (
              <button
                type="button"
                onClick={handleWithdrawClick}
                disabled={isProcessing || actionLoading !== null}
                aria-busy={actionLoading === 'withdraw'}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {actionLoading === 'withdraw' ? 'Withdrawing...' : 'Withdraw Proposal'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDenyClick}
              disabled={isProcessing || actionLoading !== null}
              aria-busy={actionLoading === 'deny'}
              className="px-4 py-2 bg-[#450a0a] hover:bg-[#7f1d1d] text-[#f87171] hover:text-white border border-[#7f1d1d] text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1"
            >
              <span>{actionLoading === 'deny' ? 'Denying...' : 'Deny Application'}</span>
              <span aria-hidden="true">✕</span>
            </button>
            <button
              type="button"
              onClick={handleAcceptClick}
              disabled={isProcessing || actionLoading !== null || isExpired}
              aria-busy={actionLoading === 'accept'}
              className={`px-5 py-2 text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1 ${
                isExpired
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                  : 'bg-[#052e16] hover:bg-[#14532d] text-[#22c55e] hover:text-white border border-[#14532d] shadow-emerald-950/40'
              }`}
            >
              <span>{actionLoading === 'accept' ? 'Accepting...' : isExpired ? 'Quote Expired' : 'Accept Application'}</span>
              <span aria-hidden="true">{isExpired ? '✕' : '✓'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5 self-end sm:self-center">
            {onOpenChat && (
              <button
                type="button"
                onClick={() => onOpenChat(walletAddr)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span aria-hidden="true">💬</span>
                <span>Chat with Freelancer</span>
              </button>
            )}
            <span className="text-xs text-[#71717a] italic">Application accepted.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicantCard;
