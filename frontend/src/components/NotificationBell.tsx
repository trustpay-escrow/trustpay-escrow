'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useWalletStore } from '@/store/walletStore';
import Link from 'next/link';

export default function NotificationBell() {
  const { address } = useWalletStore();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!address) {
    return null;
  }

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'proposal_received':
        return '📬';
      case 'proposal_accepted':
        return '🎉';
      case 'proposal_denied':
        return '📑';
      case 'milestone_submitted':
        return '⏳';
      case 'milestone_approved':
        return '💰';
      case 'dispute_opened':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Notifications"
        aria-label="Notifications"
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

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-[#121215] border border-[#27272a] shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]/50">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => refresh()}
                className="text-[#a1a1aa] hover:text-white transition-colors"
                title="Refresh"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#27272a]/60">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#a1a1aa] space-y-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="text-3xl">🔕</div>
                <p className="text-sm font-semibold text-white">No notifications yet</p>
                <p className="text-xs text-[#71717a]">
                  Activity regarding your projects, proposals, and milestones will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex items-start space-x-3 relative group ${
                    !item.is_read
                      ? 'bg-blue-950/20 hover:bg-blue-950/30'
                      : 'hover:bg-[#18181b]'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-xl bg-[#27272a]/60 border border-[#3f3f46]/40 flex items-center justify-center text-base shrink-0">
                    {getIconForType(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold ${!item.is_read ? 'text-white' : 'text-[#d4d4d8]'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[#71717a] shrink-0">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Action link */}
                    {item.link && (
                      <Link
                        href={item.link}
                        onClick={() => {
                          if (!item.is_read) markAsRead(item.id);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center text-[11px] font-semibold text-blue-400 hover:text-blue-300 mt-2 space-x-1"
                      >
                        <span>View Project</span>
                        <span>→</span>
                      </Link>
                    )}
                  </div>

                  {/* Unread indicator dot */}
                  {!item.is_read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      title="Mark as read"
                      className="w-2 h-2 rounded-full bg-blue-500 shrink-0 self-center hover:scale-125 transition-transform"
                    />
                  )}

                  {/* Delete button (visible on hover) */}
                  <button
                    onClick={() => removeNotification(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400 text-xs transition-opacity absolute right-2 top-2 p-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[#27272a] bg-[#18181b]/30 text-center">
              <span className="text-[10px] text-[#71717a]">
                Showing {notifications.length} recent notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
