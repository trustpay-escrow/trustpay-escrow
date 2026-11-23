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
  | 'active'
  | 'inactive'
  | 'archived'
  | 'failed'
  | string;

export type BadgeSize = 'sm' | 'md' | 'lg';

interface StatusConfig {
  text: string;
  bg: string;
  border: string;
  textColor: string;
  dotColor: string;
  ringColor: string;
  hasPulse: boolean;
}

export interface StatusBadgeProps {
  status: MilestoneStatus;
  label?: string;
  className?: string;
  disableAnimation?: boolean;
  size?: BadgeSize;
  showDot?: boolean;
  tooltip?: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  pending: {
    text: 'Pending',
    bg: 'bg-amber-900/20',
    border: 'border-amber-600/40',
    textColor: 'text-amber-300',
    dotColor: 'bg-amber-400',
    ringColor: 'ring-amber-400/30',
    hasPulse: true,
  },
  submitted: {
    text: 'Submitted',
    bg: 'bg-amber-900/20',
    border: 'border-amber-600/40',
    textColor: 'text-amber-300',
    dotColor: 'bg-amber-400',
    ringColor: 'ring-amber-400/30',
    hasPulse: true,
  },
  pending_review: {
    text: 'Pending Review',
    bg: 'bg-amber-900/20',
    border: 'border-amber-600/40',
    textColor: 'text-amber-300',
    dotColor: 'bg-amber-400',
    ringColor: 'ring-amber-400/30',
    hasPulse: true,
  },
  in_progress: {
    text: 'In Progress',
    bg: 'bg-blue-900/20',
    border: 'border-blue-600/40',
    textColor: 'text-blue-300',
    dotColor: 'bg-blue-400',
    ringColor: 'ring-blue-400/30',
    hasPulse: true,
  },
  active: {
    text: 'Active',
    bg: 'bg-blue-900/20',
    border: 'border-blue-600/40',
    textColor: 'text-blue-300',
    dotColor: 'bg-blue-400',
    ringColor: 'ring-blue-400/30',
    hasPulse: true,
  },
  approved: {
    text: 'Approved',
    bg: 'bg-emerald-900/20',
    border: 'border-emerald-600/40',
    textColor: 'text-emerald-300',
    dotColor: 'bg-emerald-400',
    ringColor: 'ring-emerald-400/30',
    hasPulse: false,
  },
  completed: {
    text: 'Completed',
    bg: 'bg-emerald-900/20',
    border: 'border-emerald-600/40',
    textColor: 'text-emerald-300',
    dotColor: 'bg-emerald-400',
    ringColor: 'ring-emerald-400/30',
    hasPulse: false,
  },
  revision_requested: {
    text: 'Revision Requested',
    bg: 'bg-rose-900/20',
    border: 'border-rose-600/40',
    textColor: 'text-rose-300',
    dotColor: 'bg-rose-400',
    ringColor: 'ring-rose-400/30',
    hasPulse: true,
  },
  revision: {
    text: 'Revision Requested',
    bg: 'bg-rose-900/20',
    border: 'border-rose-600/40',
    textColor: 'text-rose-300',
    dotColor: 'bg-rose-400',
    ringColor: 'ring-rose-400/30',
    hasPulse: true,
  },
  disputed: {
    text: 'Disputed',
    bg: 'bg-red-900/20',
    border: 'border-red-600/40',
    textColor: 'text-red-300',
    dotColor: 'bg-red-500',
    ringColor: 'ring-red-400/30',
    hasPulse: true,
  },
  failed: {
    text: 'Failed',
    bg: 'bg-red-900/20',
    border: 'border-red-600/40',
    textColor: 'text-red-300',
    dotColor: 'bg-red-500',
    ringColor: 'ring-red-400/30',
    hasPulse: false,
  },
  inactive: {
    text: 'Inactive',
    bg: 'bg-slate-800/30',
    border: 'border-slate-700/40',
    textColor: 'text-slate-400',
    dotColor: 'bg-slate-500',
    ringColor: 'ring-slate-500/30',
    hasPulse: false,
  },
  archived: {
    text: 'Archived',
    bg: 'bg-slate-800/30',
    border: 'border-slate-700/40',
    textColor: 'text-slate-400',
    dotColor: 'bg-slate-500',
    ringColor: 'ring-slate-500/30',
    hasPulse: false,
  },
};

export function StatusBadge({
  status,
  label,
  className = '',
  disableAnimation = false,
  size = 'md',
  showDot = true,
  tooltip,
}: StatusBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const normalized = (status || '').toLowerCase().trim();
  const config = statusConfigs[normalized] || {
    text: label || status,
    bg: 'bg-slate-800/30',
    border: 'border-slate-700/40',
    textColor: 'text-slate-400',
    dotColor: 'bg-slate-500',
    ringColor: 'ring-slate-500/30',
    hasPulse: false,
  };

  const shouldPulse = config.hasPulse && !disableAnimation;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const dotSizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  };

  const displayText = label || config.text;

  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-full font-medium border ${sizeClasses[size]} ${config.bg} ${config.border} ${config.textColor} transition-all duration-200 ${className}`}
      title={tooltip}
    >
      {/* Indicator Dot with High-Contrast Pulsing Animation */}
      {showDot && (
        <span
          data-testid="status-badge-dot"
          className={`rounded-full flex-shrink-0 ${dotSizeClasses[size]} ${config.dotColor} ${
            shouldPulse ? `motion-safe:animate-pulse ring-2 ${config.ringColor}` : ''
          }`}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">{displayText}</span>
    </span>
  );
}

export default StatusBadge;
