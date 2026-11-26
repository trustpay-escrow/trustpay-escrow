'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useWalletStore } from '@/store/walletStore';
import { NotificationCenter } from '@/components/NotificationCenter';
import { NotificationScheduleModal } from './NotificationScheduleModal';

export default function NotificationBell() {
  const { address } = useWalletStore();
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Re-key the badge on every increment so the pop-in animation replays (#197).
  const previousCount = useRef(unreadCount);
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    if (unreadCount > previousCount.current) {
      setPopKey((key) => key + 1);
    }
    previousCount.current = unreadCount;
  }, [unreadCount]);

  if (!address) {
    return null;
  }

  return (
    <>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative p-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span
            key={popKey}
            data-testid="notification-badge"
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-md animate-badge-pop"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Milestone reminder schedule */}
      <button
        type="button"
        onClick={() => setScheduleOpen(true)}
        aria-expanded={scheduleOpen}
        aria-haspopup="dialog"
        className="relative p-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-amber-400 hover:text-amber-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Milestone reminder schedule"
        aria-label="Open milestone reminder schedule"
      >
        <span aria-hidden="true">⏰</span>
      </button>

      {/* Slide-over Notification Drawer */}
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <NotificationScheduleModal
        project={null}
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </>
  );
}
