'use client';

import React from 'react';
import { Milestone, Project } from '@/types';
import { useTimelock, UrgencyLevel } from '@/hooks/useTimelock';

export interface TimelockCountdownBannerProps {
  milestone: Milestone;
  project?: Project | null;
  onApprove?: (milestone: Milestone) => void | Promise<void>;
  onRequestRevision?: (milestone: Milestone) => void | Promise<void>;
  currentLedgerSequence?: number;
  timelockLedgerSequence?: number;
  className?: string;
}

export function TimelockCountdownBanner({
  milestone,
  project,
  onApprove,
  onRequestRevision,
  currentLedgerSequence,
  timelockLedgerSequence,
  className = '',
}: TimelockCountdownBannerProps) {
  const {
    days,
    hours,
    minutes,
    seconds,
    totalSecondsRemaining,
    formatted,
    isExpired,
    urgency,
    progressPercent,
  } = useTimelock({
    submittedAt: milestone.submitted_at,
    autoReleaseAt: milestone.auto_release_at,
    durationDays: 14,
    currentLedgerSequence,
    timelockLedgerSequence,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
  });

  // Urgency styling configurations: Green > 7d, Amber < 3d, Red < 24h
  const urgencyStyles: Record<
    UrgencyLevel,
    {
      wrapper: string;
      badge: string;
      ringStroke: string;
      ringBg: string;
      dot: string;
      label: string;
      title: string;
    }
  > = {
    green: {
      wrapper: 'bg-[#052e16]/80 border-emerald-500/40 shadow-emerald-950/40 text-emerald-100',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      ringStroke: '#10b981',
      ringBg: 'rgba(16, 185, 129, 0.2)',
      dot: 'bg-emerald-400',
      label: 'Standard Review Window',
      title: 'Review Window Active (> 7 Days Left)',
    },
    amber: {
      wrapper: 'bg-[#451a03]/85 border-amber-500/50 shadow-amber-950/40 text-amber-100',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      ringStroke: '#f59e0b',
      ringBg: 'rgba(245, 158, 11, 0.2)',
      dot: 'bg-amber-400',
      label: 'Approaching Inactivity Timelock (< 3 Days)',
      title: 'Action Needed: Inactivity Auto-Release Approaching',
    },
    red: {
      wrapper: 'bg-[#450a0a]/90 border-red-500/60 shadow-red-950/50 text-red-100 ring-2 ring-red-500/30 animate-pulse',
      badge: 'bg-red-500/20 text-red-300 border-red-500/40',
      ringStroke: '#ef4444',
      ringBg: 'rgba(239, 68, 68, 0.2)',
      dot: 'bg-red-400',
      label: 'CRITICAL WARNING: Auto-Release in < 24 Hours!',
      title: 'Urgent: Funds Will Auto-Release to Freelancer Today',
    },
  };

  const currentStyle = urgencyStyles[urgency];
  const tokenSymbol = project?.token || 'USDC';

  // SVG Circular Urgency Ring calculation
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-2xl border p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all duration-300 ${currentStyle.wrapper} ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Urgency Ring + Warning Message */}
        <div className="flex items-start sm:items-center space-x-4">
          {/* Circular Urgency Ring */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke={currentStyle.ringBg}
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke={currentStyle.ringStroke}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-extrabold tracking-tighter">
                {isExpired ? '0d' : `${days}d`}
              </span>
              <span className="text-[8px] font-semibold uppercase opacity-80">left</span>
            </div>
          </div>

          {/* Details & Inactivity Policy Explanation */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${currentStyle.badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${currentStyle.dot} animate-ping`} />
                {currentStyle.label}
              </span>
              <span className="text-xs font-mono opacity-75">
                Milestone #{milestone.milestone_index + 1}: {milestone.title} ({milestone.amount}{' '}
                {tokenSymbol})
              </span>
            </div>

            <h4 className="text-sm sm:text-base font-extrabold tracking-tight">
              {currentStyle.title}
            </h4>

            <p className="text-xs opacity-90 max-w-xl leading-relaxed">
              Smart contracts enforce a <strong>14-day inactivity auto-release rule</strong> to
              prevent freelancer ghosting. If deliverables are not reviewed or revisions are not
              requested before the timer expires, escrow funds will automatically transfer to the
              freelancer.
            </p>
          </div>
        </div>

        {/* Center Section: Ticking Digital Countdown Display */}
        <div className="flex items-center justify-center gap-2 bg-black/40 px-3.5 py-2.5 rounded-xl border border-white/10 shrink-0">
          <div className="text-center min-w-[38px]">
            <div className="text-lg sm:text-xl font-mono font-black tracking-tight">
              {String(days).padStart(2, '0')}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold opacity-75">Days</div>
          </div>
          <span className="text-lg font-bold opacity-40">:</span>
          <div className="text-center min-w-[38px]">
            <div className="text-lg sm:text-xl font-mono font-black tracking-tight">
              {String(hours).padStart(2, '0')}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold opacity-75">Hours</div>
          </div>
          <span className="text-lg font-bold opacity-40">:</span>
          <div className="text-center min-w-[38px]">
            <div className="text-lg sm:text-xl font-mono font-black tracking-tight">
              {String(minutes).padStart(2, '0')}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold opacity-75">Mins</div>
          </div>
          <span className="text-lg font-bold opacity-40">:</span>
          <div className="text-center min-w-[38px]">
            <div className="text-lg sm:text-xl font-mono font-black tracking-tight text-white">
              {String(seconds).padStart(2, '0')}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold opacity-75">Secs</div>
          </div>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-2 sm:self-auto self-stretch">
          {onRequestRevision && (
            <button
              type="button"
              onClick={() => onRequestRevision(milestone)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/40 hover:bg-black/60 text-white font-bold text-xs rounded-xl border border-white/20 hover:border-white/40 transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              Request Revision ↺
            </button>
          )}

          {onApprove && (
            <button
              type="button"
              onClick={() => onApprove(milestone)}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              Approve Now ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default TimelockCountdownBanner;
