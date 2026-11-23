'use client';

import React, { useState, useEffect } from 'react';

export interface ProposalExpirationBadgeProps {
  expiresAt?: string;
  onExpire?: () => void;
  className?: string;
}

export function formatTimeRemaining(targetDate: Date): { text: string; isExpired: boolean } {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: 'Quote expired', isExpired: true };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return { text: `Quote expires in ${days}d ${hours}h`, isExpired: false };
  }
  if (hours > 0) {
    return { text: `Quote expires in ${hours}h ${minutes}m`, isExpired: false };
  }
  return { text: `Quote expires in ${minutes}m`, isExpired: false };
}

export function ProposalExpirationBadge({ expiresAt, onExpire, className = '' }: ProposalExpirationBadgeProps) {
  const [timeInfo, setTimeInfo] = useState<{ text: string; isExpired: boolean } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const target = new Date(expiresAt);
    if (isNaN(target.getTime())) return;

    const update = () => {
      const info = formatTimeRemaining(target);
      setTimeInfo(info);
      if (info.isExpired && onExpire) {
        onExpire();
      }
    };

    update();
    const interval = setInterval(update, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (!expiresAt || !timeInfo) {
    return null;
  }

  if (timeInfo.isExpired) {
    return (
      <span
        data-testid="proposal-expired-badge"
        className={`px-2.5 py-1 bg-red-950/80 text-red-400 border border-red-800/60 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {timeInfo.text}
      </span>
    );
  }

  return (
    <span
      data-testid="proposal-countdown-badge"
      className={`px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {timeInfo.text}
    </span>
  );
}
