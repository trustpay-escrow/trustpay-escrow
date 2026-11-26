'use client';

import React, { useState } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineQueueDrawer } from '@/components/OfflineQueueDrawer';

/**
 * Small pill indicator showing the number of pending offline items.
 * Clicking opens the OfflineQueueDrawer.
 */
export function OfflineStatusPill({ className = '' }: { className?: string } = {}) {
  const { pendingCount, isOnline } = useOfflineSync();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (pendingCount === 0 && isOnline) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        disabled={pendingCount === 0}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${className} ${
          pendingCount > 0
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
        }`}
        aria-label={pendingCount > 0 ? `Open offline queue (${pendingCount} pending)` : 'All synced'}
        data-testid="offline-status-pill"
      >
        <span className="relative flex items-center justify-center">
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-black flex items-center justify-center animate-pulse">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
        </span>
        <span className="hidden sm:inline">
          {pendingCount > 0 ? `${pendingCount} pending` : 'Synced'}
        </span>
      </button>

      <OfflineQueueDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

export default OfflineStatusPill;