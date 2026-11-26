'use client';

import React from 'react';
import { OfflineQueueItem, useOfflineSync } from '@/hooks/useOfflineSync';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface OfflineQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (isoString: string): string => {
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

const formatPayloadSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getTagStyle = (tag?: string): string => {
  switch (tag) {
    case 'draft':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'submission':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'approval':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
};

/** Bottom slide-out drawer showing queued offline operations. */
export function OfflineQueueDrawer({ isOpen, onClose }: OfflineQueueDrawerProps) {
  const {
    queue,
    processing,
    discard,
    retry,
    flushQueue,
    pendingCount,
  } = useOfflineSync();

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Offline queue"
        className="relative w-full max-h-[80vh] bg-[#101014] border-t border-[#27272a] shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-in-out"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] bg-[#141418] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              ⏳
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Offline Queue</h2>
              <p className="text-[11px] text-[#71717a]">
                {pendingCount} pending item{pendingCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {pendingCount > 0 && !processing && (
              <button
                type="button"
                onClick={() => void flushQueue()}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                title="Retry all queued items"
              >
                Retry All
              </button>
            )}
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

        {/* Queue List */}
        {queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              ✓
            </div>
            <p className="text-slate-300 font-medium">No pending offline items</p>
            <p className="text-xs text-slate-500 mt-1">Everything is synced!</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {queue.map((item) => (
              <OfflineQueueItemCard key={item.id} item={item} onDiscard={discard} onRetry={retry} disabled={processing} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a] bg-[#141418] flex items-center justify-between">
          <p className="text-[11px] text-[#71717a]">
            Items are stored locally and will retry automatically when online.
          </p>
          {processing && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              Processing...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Individual queue item card. */
function OfflineQueueItemCard({
  item,
  onDiscard,
  onRetry,
  disabled,
}: {
  item: OfflineQueueItem;
  onDiscard: (id: string) => void;
  onRetry: (id: string) => Promise<boolean>;
  disabled: boolean;
}) {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry(item.id);
    setRetrying(false);
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        disabled ? 'opacity-60' : 'hover:border-slate-700'
      } ${(item.retryCount ?? 0) > 0 ? 'border-amber-500/30 bg-amber-950/20' : 'border-slate-800 bg-slate-950/50'}`}
      data-testid={`offline-queue-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-semibold text-white truncate">{item.description}</span>
            {item.tag && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getTagStyle(item.tag)}`}
              >
                {item.tag}
              </span>
            )}
            {(item.retryCount ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                ↻ {item.retryCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="font-mono text-slate-400">{item.method}</span>
            <span className="truncate max-w-[200px] font-mono">{item.url}</span>
            <span>{formatTimestamp(item.queuedAt)}</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700 font-mono">
              {formatPayloadSize(item.payloadSize ?? 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!confirmDiscard ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                disabled={disabled || retrying}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Retry now"
              >
                {retrying ? 'Retrying...' : 'Retry'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-300 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                title="Discard this item"
              >
                Discard
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Discard?</span>
              <button
                type="button"
                onClick={() => onDiscard(item.id)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-300 bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-colors"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineQueueDrawer;