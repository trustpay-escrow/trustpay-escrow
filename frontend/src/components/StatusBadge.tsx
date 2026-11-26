'use client';

import React, { useState, useRef, useEffect, useId } from 'react';

export type MilestoneStatus =
  | 'pending'
  | 'submitted'
  | 'pending_review'
  | 'in_progress'
  | 'approved'
  | 'completed'
  | 'revision_requested'
  | 'disputed'
  | string;

export interface StatusBadgeProps {
  status: MilestoneStatus;
  label?: string;
  className?: string;
  disableAnimation?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const STATUS_TOOLTIPS: Record<string, string> = {
  pending: 'Pending: Work has not started yet. Freelancer will begin work shortly.',
  in_progress: 'In Progress: Freelancer is actively developing deliverables.',
  submitted: 'Submitted: Client has 14 days to approve or request revisions before auto-release.',
  pending_review: 'In Review: Client is evaluating submitted deliverables and code.',
  approved: 'Approved: Work has been accepted. Funds are releasing to freelancer wallet.',
  completed: 'Completed: Milestone settlement complete and on-chain escrow finalized.',
  revision_requested: 'Revision Requested: Freelancer must submit updated deliverables addressing feedback.',
  disputed: 'Disputed: Arbiter is reviewing evidence to resolve locked escrow funds.',
};

export function getStatusTooltip(status: string): string {
  const norm = (status || '').toLowerCase().trim();
  if (norm === 'submitted') return STATUS_TOOLTIPS.submitted;
  if (norm === 'pending_review') return STATUS_TOOLTIPS.pending_review;
  if (norm === 'pending') return STATUS_TOOLTIPS.pending;
  if (norm === 'approved') return STATUS_TOOLTIPS.approved;
  if (norm === 'completed') return STATUS_TOOLTIPS.completed;
  if (norm === 'revision_requested' || norm === 'revision') return STATUS_TOOLTIPS.revision_requested;
  if (norm === 'disputed') return STATUS_TOOLTIPS.disputed;
  if (norm === 'in_progress') return STATUS_TOOLTIPS.in_progress;
  return `Current status: ${status}`;
}

export function StatusBadge({
  status,
  label,
  className = '',
  disableAnimation = false,
  size = 'md',
}: StatusBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const normalized = (status || '').toLowerCase().trim();

  const isPendingReview =
    normalized === 'submitted' ||
    normalized === 'pending_review' ||
    normalized === 'pending';

  const isApproved = normalized === 'approved' || normalized === 'completed';
  const isRevision = normalized === 'revision_requested' || normalized === 'revision';
  const isDisputed = normalized === 'disputed';
  const isInProgress = normalized === 'in_progress';

  let config = {
    text: label || 'Pending Review',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    textColor: 'text-amber-400',
    dotColor: 'bg-amber-400',
    hasPulse: true,
  };

  if (isApproved) {
    config = {
      text: label || 'Approved',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      textColor: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      hasPulse: false,
    };
  } else if (isRevision) {
    config = {
      text: label || 'Revision Requested',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      textColor: 'text-rose-400',
      dotColor: 'bg-rose-400',
      hasPulse: false,
    };
  } else if (isDisputed) {
    config = {
      text: label || 'Disputed',
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      textColor: 'text-red-400',
      dotColor: 'bg-red-400',
      hasPulse: false,
    };
  } else if (isInProgress) {
    config = {
      text: label || 'In Progress',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      textColor: 'text-indigo-400',
      dotColor: 'bg-indigo-400',
      hasPulse: false,
    };
  } else if (!isPendingReview) {
    config = {
      text: label || status,
      bg: 'bg-slate-800/60',
      border: 'border-slate-700/60',
      textColor: 'text-slate-300',
      dotColor: 'bg-slate-400',
      hasPulse: false,
    };
  }

  const shouldPulse = config.hasPulse && !disableAnimation;
  const tooltipText = getStatusTooltip(status);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleTouch = () => {
    if (isVisible) {
      hideTooltip();
    } else {
      setIsVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative inline-block">
      <span
        data-testid="status-badge"
        tabIndex={0}
        role="status"
        aria-describedby={isVisible ? tooltipId : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={handleTouch}
        className={`inline-flex items-center gap-1.5 ${
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
        } rounded-full font-medium border cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400/50 ${config.bg} ${config.border} ${config.textColor} ${className}`}
      >
        {/* 6px Indicator Dot with Amber CSS Pulse Animation */}
        <span
          data-testid="status-badge-dot"
          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${
            shouldPulse ? 'motion-safe:animate-pulse ring-2 ring-amber-400/20' : ''
          }`}
          aria-hidden="true"
        />
        <span>{config.text}</span>
      </span>

      {isVisible && (
        <div
          id={tooltipId}
          data-testid="status-badge-tooltip"
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-slate-100 bg-slate-900/95 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-sm whitespace-normal w-max max-w-xs text-center pointer-events-none transition-all duration-200"
        >
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
        </div>
      )}
    </div>
  );
}

export default StatusBadge;
