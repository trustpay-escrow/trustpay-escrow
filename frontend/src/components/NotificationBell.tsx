'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useWalletStore } from '@/store/walletStore';
import { NotificationCenter } from '@/components/NotificationCenter';

export default function NotificationBell() {
  const { address } = useWalletStore();
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  if (!address) {
    return null;
  }

  return (
    <>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative p-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Notifications"
        aria-label="Open notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over Notification Drawer */}
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
