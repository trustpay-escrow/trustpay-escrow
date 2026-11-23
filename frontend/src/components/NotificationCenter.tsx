'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationSounds } from '@/hooks/useNotificationSounds';
import { NotificationCategory, NotificationItem, getNotificationCategory } from '@/types/notification';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const {
    filteredNotifications,
    unreadCountsByCategory,
    activeTab,
    setActiveTab,
    loading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh,
  } = useNotifications();

  const { isMuted, toggleMute, volume, setNotificationVolume } = useNotificationSounds();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const tabs: { key: NotificationCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: '🔔' },
    { key: 'escrow', label: 'Escrow', icon: '💰' },
    { key: 'proposals', label: 'Proposals', icon: '📬' },
    { key: 'disputes', label: 'Disputes', icon: '⚠️' },
    { key: 'system', label: 'System', icon: '⚙️' },
  ];

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

  const getIconForNotification = (item: NotificationItem) => {
    const cat = getNotificationCategory(item);
    switch (cat) {
      case 'proposals':
        return '📬';
      case 'disputes':
        return '⚖️';
      case 'escrow':
        return '💰';
      default:
        return '🔔';
    }
  };

  const getTargetLink = (item: NotificationItem): string => {
    if (item.link) return item.link;
    if (item.project_id) return `/projects/${item.project_id}`;
    return '/projects';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop overlay with fade */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification Center"
        className="relative w-full max-w-md h-full bg-[#101014] border-l border-[#27272a] shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-in-out"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] bg-[#141418] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              🔔
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Notification Center</h2>
              <p className="text-[11px] text-[#71717a]">Escrow alerts & updates</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => refresh()}
              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
              title="Refresh"
            >
              🔄
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
              title="Close Drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sound Settings Bar */}
        <div className="px-4 py-2.5 bg-[#18181d] border-b border-[#27272a] flex items-center justify-between text-xs text-[#a1a1aa]">
          <div className="flex items-center space-x-2">
            <span>{isMuted ? '🔇' : '🔊'}</span>
            <span className="text-[11px] font-medium text-[#d4d4d8]">Sound Alerts</span>
          </div>
          <div className="flex items-center space-x-3">
            {!isMuted && (
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setNotificationVolume(Number(e.target.value))}
                className="w-16 h-1 accent-blue-500 cursor-pointer"
                title={`Volume: ${volume}%`}
              />
            )}
            <button
              type="button"
              onClick={toggleMute}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-1 px-3 py-2 bg-[#121216] border-b border-[#27272a] overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = unreadCountsByCategory[tab.key] || 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#1e1e24]'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Actions (Mark All Read) */}
        <div className="px-4 py-2 border-b border-[#27272a] flex items-center justify-between text-xs">
          <span className="text-[#71717a]">
            {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
          </span>
          {unreadCountsByCategory[activeTab] > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              ✓ Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#27272a]/60">
          {loading && filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#a1a1aa] space-y-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="text-3xl">🔕</div>
              <p className="text-sm font-semibold text-white">No notifications in this tab</p>
              <p className="text-xs text-[#71717a] max-w-xs mx-auto">
                Any updates regarding your escrows, proposals, milestones, or dispute events will show up here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const deepLink = getTargetLink(item);
              return (
                <div
                  key={item.id}
                  className={`p-4 transition-colors flex items-start space-x-3.5 relative group ${
                    !item.is_read ? 'bg-blue-950/20 hover:bg-blue-950/30' : 'hover:bg-[#18181c]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#232328] border border-[#333338] flex items-center justify-center text-lg shrink-0 shadow-inner">
                    {getIconForNotification(item)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${!item.is_read ? 'text-white' : 'text-[#d4d4d8]'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[#71717a] shrink-0 font-medium">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>

                    {/* 1-Click Deep Link */}
                    <div className="mt-2.5 flex items-center space-x-3">
                      <Link
                        href={deepLink}
                        onClick={() => {
                          if (!item.is_read) markAsRead(item.id);
                          onClose();
                        }}
                        className="inline-flex items-center text-[11px] font-bold text-blue-400 hover:text-blue-300 space-x-1 transition-colors"
                      >
                        <span>View Details</span>
                        <span>→</span>
                      </Link>
                      {!item.is_read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          className="text-[11px] text-[#71717a] hover:text-[#d4d4d8] transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 self-center" />
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => removeNotification(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400 text-xs transition-opacity absolute right-2.5 top-2.5 p-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationCenter;
