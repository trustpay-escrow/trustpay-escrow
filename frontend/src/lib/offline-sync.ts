'use client';

const DB_NAME = 'trustpay_offline_db';
const DB_VERSION = 1;

export interface OfflineDraft<T = any> {
  key: string;
  data: T;
  type: 'project' | 'proposal' | 'deliverable' | 'milestones';
  updatedAt: number;
}

export interface QueuedSyncRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timestamp: number;
  retryCount: number;
  description?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save in-progress draft (project creation, proposal, deliverable notes) to IndexedDB
 */
export async function saveDraft<T>(
  key: string,
  data: T,
  type: 'project' | 'proposal' | 'deliverable' | 'milestones'
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const record: OfflineDraft<T> = {
        key,
        data,
        type,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save draft to IndexedDB:', err);
  }
}

/**
 * Retrieve draft from IndexedDB
 */
export async function getDraft<T>(key: string): Promise<OfflineDraft<T> | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get draft from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete draft from IndexedDB upon successful submission
 */
export async function deleteDraft(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete draft from IndexedDB:', err);
  }
}

/**
 * Enqueue an API request for offline background sync upon reconnect
 */
export async function enqueueSyncRequest(params: {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  description?: string;
}): Promise<string> {
  const db = await openDB();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: QueuedSyncRequest = {
    id,
    url: params.url,
    method: params.method || 'POST',
    headers: params.headers || { 'Content-Type': 'application/json' },
    body: params.body,
    timestamp: Date.now(),
    retryCount: 0,
    description: params.description || 'Queued submission',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const req = store.put(item);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all queued sync requests
 */
export async function getSyncQueue(): Promise<QueuedSyncRequest[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove a processed request from sync_queue
 */
export async function dequeueSyncRequest(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to dequeue sync request:', err);
  }
}

/**
 * Synchronize queued drafts and uploads when connection is re-established
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        await dequeueSyncRequest(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
    }
  }

  return { synced, failed };
}
