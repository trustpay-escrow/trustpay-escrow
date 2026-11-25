'use client';

import React from 'react';
import Link from 'next/link';

export type EmptyStateType = 'projects' | 'proposals' | 'notifications' | 'generic';

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const DEFAULT_CONFIGS: Record<
  EmptyStateType,
  {
    title: string;
    description: string;
    actionLabel: string;
    actionHref?: string;
  }
> = {
  projects: {
    title: 'No Active Escrow Projects',
    description:
      'You have not created or joined any escrow projects yet. Launch your first project to secure milestone payments on Stellar.',
    actionLabel: 'Post Your First Escrow',
    actionHref: '/create-project',
  },
  proposals: {
    title: 'No Proposals Found',
    description:
      'You have not submitted or received any job proposals. Explore open marketplace projects and submit your first proposal.',
    actionLabel: 'Browse Open Jobs',
    actionHref: '/projects',
  },
  notifications: {
    title: 'All Caught Up!',
    description:
      'You have zero unread notifications. Updates regarding milestones, releases, and disputes will appear here.',
    actionLabel: 'View Activity Feed',
  },
  generic: {
    title: 'No Items Available',
    description:
      'There is nothing to display right now. Check back soon or start by adding a new record.',
    actionLabel: 'Get Started',
  },
};

function EmptyProjectsIcon() {
  return (
    <svg
      className="w-20 h-20 text-indigo-400/80"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="empty-projects-icon"
    >
      <rect x="18" y="14" width="44" height="54" rx="8" className="fill-[#1c1c20] stroke-indigo-500/40" strokeWidth="2" />
      <rect x="26" y="24" width="28" height="4" rx="2" className="fill-indigo-500/60" />
      <rect x="26" y="34" width="20" height="4" rx="2" className="fill-zinc-600" />
      <rect x="26" y="44" width="24" height="4" rx="2" className="fill-zinc-700" />
      <circle cx="50" cy="52" r="14" className="fill-indigo-950/80 stroke-indigo-400" strokeWidth="2" />
      <path d="M46 52l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyProposalsIcon() {
  return (
    <svg
      className="w-20 h-20 text-emerald-400/80"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="empty-proposals-icon"
    >
      <rect x="16" y="18" width="48" height="46" rx="8" className="fill-[#1c1c20] stroke-emerald-500/40" strokeWidth="2" />
      <path d="M26 30h28M26 40h20M26 50h14" stroke="#52525b" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="54" cy="48" r="13" className="fill-emerald-950/80 stroke-emerald-400" strokeWidth="2" />
      <text x="54" y="53" textAnchor="middle" fill="#34d399" fontSize="13" fontWeight="bold">✦</text>
    </svg>
  );
}

function EmptyNotificationsIcon() {
  return (
    <svg
      className="w-20 h-20 text-amber-400/80"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="empty-notifications-icon"
    >
      <circle cx="40" cy="40" r="26" className="fill-[#1c1c20] stroke-amber-500/30" strokeWidth="2" />
      <path
        d="M40 24a10 10 0 00-10 10v7l-3 4v2h26v-2l-3-4v-7a10 10 0 00-10-10z"
        className="fill-amber-500/20 stroke-amber-400"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M37 51a3 3 0 006 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EmptyGenericIcon() {
  return (
    <svg
      className="w-20 h-20 text-blue-400/80"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="empty-generic-icon"
    >
      <circle cx="36" cy="36" r="18" className="fill-[#1c1c20] stroke-blue-500/40" strokeWidth="2" />
      <path d="M49 49l13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="36" cy="36" r="6" className="fill-blue-500/30 stroke-blue-400" strokeWidth="1.5" />
    </svg>
  );
}

export function EmptyState({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}: EmptyStateProps) {
  const config = DEFAULT_CONFIGS[type] || DEFAULT_CONFIGS.generic;

  const displayTitle = title ?? config.title;
  const displayDescription = description ?? config.description;
  const displayActionLabel = actionLabel ?? config.actionLabel;
  const displayActionHref = actionHref ?? config.actionHref;

  const renderIcon = () => {
    switch (type) {
      case 'projects':
        return <EmptyProjectsIcon />;
      case 'proposals':
        return <EmptyProposalsIcon />;
      case 'notifications':
        return <EmptyNotificationsIcon />;
      default:
        return <EmptyGenericIcon />;
    }
  };

  return (
    <div
      data-testid="empty-state-card"
      className={`bg-[#18181b]/70 border border-[#27272a] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto flex flex-col items-center justify-center space-y-4 shadow-xl transition-all ${className}`}
    >
      <div className="p-3 bg-[#202024] rounded-2xl border border-[#2e2e33] shadow-inner mb-1">
        {renderIcon()}
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight" data-testid="empty-state-title">
          {displayTitle}
        </h3>
        <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed" data-testid="empty-state-description">
          {displayDescription}
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        {displayActionHref ? (
          <Link
            href={displayActionHref}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-center cursor-pointer"
            data-testid="empty-state-primary-action"
          >
            {displayActionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-center cursor-pointer"
            data-testid="empty-state-primary-action"
          >
            {displayActionLabel}
          </button>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-xs font-semibold rounded-xl border border-[#3f3f46] transition-all text-center cursor-pointer"
            data-testid="empty-state-secondary-action"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
