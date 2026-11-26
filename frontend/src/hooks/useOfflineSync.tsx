'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  saveDraft,
  getDraft,
  deleteDraft,
  enqueueSyncRequest,
  processSyncQueue,
  getSyncQueue,
  dequeueSyncRequest,
  OfflineDraft,
} from '@/lib/offline-sync';

export interface OfflineQueueItem {
  id: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  payload?: any;
  queuedAt: string;
  payloadSize?: number;
  retryCount?: number;
  tag?: string;
}

export interface UseOfflineSyncOptions {
  draftKey?: string;
  draftType?: 'project' | 'proposal' | 'deliverable' | 'milestones';
  autoSyncOnOnline?: boolean;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    draftKey,
    draftType = 'project',
    autoSyncOnOnline = true,
  } = options;

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return navigator.onLine;
    return true;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const isOnlineRef = useRef<boolean>(isOnline);

  const refreshQueueCount = useCallback(async () => {
    try {
      const q = await getSyncQueue();
      setQueuedCount(q.length);
      setQueue(
        q.map((item) => ({
          id: item.id,
          description: item.description || 'Queued submission',
          method: item.method as any,
          url: item.url,
          payload: item.body,
          queuedAt: new Date(item.timestamp).toISOString(),
          payloadSize: item.body ? JSON.stringify(item.body).length : 0,
          retryCount: item.retryCount || 0,
          tag: item.url.includes('milestone') ? 'submission' : 'draft',
        }))
      );
    } catch {
      setQueuedCount(0);
      setQueue([]);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const { synced, failed } = await processSyncQueue();
      await refreshQueueCount();
      if (synced > 0) {
        toast.success(`Successfully synchronized ${synced} offline submission(s) to server!`, {
          duration: 5000,
        });
      }
    } catch (err: any) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshQueueCount]);

  // Online / offline event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      if (autoSyncOnOnline) {
        triggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
      toast.warning('Network disconnected. Working offline — changes will save locally.', {
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSyncOnOnline, triggerSync, refreshQueueCount]);

  // Helper to save draft
  const persistDraft = useCallback(
    async (data: any, keyOverride?: string) => {
      const targetKey = keyOverride || draftKey;
      if (!targetKey) return;
      await saveDraft(targetKey, data, draftType);
    },
    [draftKey, draftType]
  );

  // Helper to restore draft
  const loadDraft = useCallback(
    async <T,>(keyOverride?: string): Promise<T | null> => {
      const targetKey = keyOverride || draftKey;
      if (!targetKey) return null;
      const res = await getDraft<T>(targetKey);
      return res ? res.data : null;
    },
    [draftKey]
  );

  // Helper to clear draft
  const removeDraft = useCallback(
    async (keyOverride?: string) => {
      const targetKey = keyOverride || draftKey;
      if (!targetKey) return;
      await deleteDraft(targetKey);
    },
    [draftKey]
  );

  // Helper to queue submission when offline
  const queueSubmission = useCallback(
    async (params: {
      url: string;
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      body?: any;
      description?: string;
    }) => {
      const id = await enqueueSyncRequest(params);
      await refreshQueueCount();
      return id;
    },
    [refreshQueueCount]
  );

  const discard = useCallback(
    async (id: string) => {
      await dequeueSyncRequest(id);
      await refreshQueueCount();
    },
    [refreshQueueCount]
  );

  const retry = useCallback(
    async (id: string): Promise<boolean> => {
      const q = await getSyncQueue();
      const item = q.find((i) => i.id === id);
      if (!item) return false;
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers || { 'Content-Type': 'application/json' },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        if (res.ok) {
          await dequeueSyncRequest(id);
          await refreshQueueCount();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [refreshQueueCount]
  );

  return {
    isOnline,
    isSyncing,
    queuedCount,
    pendingCount: queuedCount,
    queue,
    processing: isSyncing,
    discard,
    retry,
    flushQueue: triggerSync,
    persistDraft,
    loadDraft,
    removeDraft,
    queueSubmission,
    triggerSync,
    refreshQueueCount,
  };
}

/**
 * Amber status pill displayed when network disconnects
 */
export function OfflineStatusPill({ className = '' }: { className?: string } = {}) {
  const { isOnline, queuedCount } = useOfflineSync();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-md animate-pulse ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      <span>Offline — Changes Saved Locally</span>
      {queuedCount > 0 && (
        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-bold">
          {queuedCount} queued
        </span>
      )}
    </div>
  );
}

export default useOfflineSync;
