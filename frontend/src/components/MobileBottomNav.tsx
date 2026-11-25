'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export interface MobileBottomNavProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  onCreateClick?: () => void;
  unreadNotificationsCount?: number;
  className?: string;
}

export function MobileBottomNav({
  currentTab = 'projects',
  onTabChange,
  onCreateClick,
  unreadNotificationsCount = 0,
  className = '',
}: MobileBottomNavProps) {
  const [activeTab, setActiveTab] = useState(currentTab);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const handleCreateTrigger = () => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      setIsDrawerOpen((prev) => !prev);
    }
  };

  return (
    <>
      {/* Bottom Action Drawer Sheet */}
      {isDrawerOpen && (
        <div
          data-testid="mobile-drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center md:hidden animate-in fade-in duration-200"
        >
          <div
            data-testid="mobile-action-drawer"
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#18181b] border-t border-[#2e2e33] rounded-t-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto"
          >
            {/* Drawer Drag Handle */}
            <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <h3 className="text-base font-bold text-white">Quick Actions</h3>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close drawer"
                className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white text-base rounded-full hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <Link
                href="/create-project"
                onClick={() => setIsDrawerOpen(false)}
                className="flex items-center gap-3 p-3.5 bg-[#232326] hover:bg-[#2a2a30] rounded-xl border border-[#333338] text-white transition-all active:scale-98 min-h-[48px]"
              >
                <span className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-lg font-bold">
                  +
                </span>
                <div>
                  <div className="text-sm font-semibold">Post New Escrow</div>
                  <div className="text-xs text-zinc-400">Lock milestone funds with smart contract safety</div>
                </div>
              </Link>

              <Link
                href="/projects"
                onClick={() => setIsDrawerOpen(false)}
                className="flex items-center gap-3 p-3.5 bg-[#232326] hover:bg-[#2a2a30] rounded-xl border border-[#333338] text-white transition-all active:scale-98 min-h-[48px]"
              >
                <span className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-lg">
                  🔍
                </span>
                <div>
                  <div className="text-sm font-semibold">Browse Marketplace</div>
                  <div className="text-xs text-zinc-400">Explore open client escrow listings</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (<768px viewports) */}
      <nav
        data-testid="mobile-bottom-nav"
        aria-label="Mobile Navigation"
        className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#141417]/95 backdrop-blur-lg border-t border-[#27272a] px-3 py-1.5 shadow-2xl ${className}`}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* Projects Tab */}
          <button
            type="button"
            data-testid="tab-projects"
            onClick={() => handleTabClick('projects')}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 transition-colors rounded-xl ${
              activeTab === 'projects' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-[10px] font-medium">Projects</span>
          </button>

          {/* Proposals Tab */}
          <button
            type="button"
            data-testid="tab-proposals"
            onClick={() => handleTabClick('proposals')}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 transition-colors rounded-xl ${
              activeTab === 'proposals' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[10px] font-medium">Proposals</span>
          </button>

          {/* Center Floating Action Button */}
          <button
            type="button"
            data-testid="mobile-create-trigger"
            onClick={handleCreateTrigger}
            aria-label="Create Escrow or Quick Actions"
            className="flex items-center justify-center w-12 h-12 -mt-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-full shadow-lg shadow-indigo-600/40 border-2 border-[#18181b] transition-all cursor-pointer min-w-[48px] min-h-[48px]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Notifications Tab */}
          <button
            type="button"
            data-testid="tab-notifications"
            onClick={() => handleTabClick('notifications')}
            className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 transition-colors rounded-xl ${
              activeTab === 'notifications' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#141417]" />
              )}
            </div>
            <span className="text-[10px] font-medium">Alerts</span>
          </button>

          {/* Wallet Tab */}
          <button
            type="button"
            data-testid="tab-wallet"
            onClick={() => handleTabClick('wallet')}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 transition-colors rounded-xl ${
              activeTab === 'wallet' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[10px] font-medium">Wallet</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default MobileBottomNav;
