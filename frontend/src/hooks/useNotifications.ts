import { celebrateEscrow } from '@/lib/confetti';
import { authFetch } from '@/lib/api';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletStore } from '@/store/walletStore';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationItem,
  NotificationPreferences,
  NotificationCategory,
  getNotificationCategory,
} from '@/types/notification';
import { toast } from 'sonner';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useNotifications() {
  const { address, token } = useWalletStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [preferencesLoading, setPreferencesLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!address) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/notifications/${encodeURIComponent(address)}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: unknown) {
      if (!silent) {
        console.error('Error loading notifications:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [address]);

  const mergePreferences = useCallback((value: Partial<NotificationPreferences> & { telegram_chat_id?: string } | null | undefined): NotificationPreferences => {
    return {
      intervals: { ...DEFAULT_NOTIFICATION_PREFERENCES.intervals, ...(value?.intervals || {}) },
      channels: { ...DEFAULT_NOTIFICATION_PREFERENCES.channels, ...(value?.channels || {}) },
      telegramChatId: value?.telegramChatId ?? value?.telegram_chat_id ?? '',
    };
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!address) {
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    setPreferencesLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/users/me/notification-preferences`);
      if (res.ok) {
        const data = await res.json();
        setPreferences(mergePreferences(data.preferences || data));
        return;
      }
    } catch {
      // Fall through to local cache when the backend preference endpoint is unavailable.
    }

    try {
      const cached = window.localStorage.getItem('trustpay-notification-preferences');
      if (cached) setPreferences(mergePreferences(JSON.parse(cached)));
    } catch {
      // Ignore malformed local preference cache.
    } finally {
      setPreferencesLoading(false);
    }
  }, [address, mergePreferences]);

  const savePreferences = useCallback(async (next: NotificationPreferences): Promise<boolean> => {
    const merged = mergePreferences(next);
    setPreferences(merged);

    try {
      window.localStorage.setItem('trustpay-notification-preferences', JSON.stringify(merged));
    } catch {
      // localStorage is best-effort only.
    }

    if (!address) return true;

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/users/me/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: merged }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to sync notification preferences');
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (data.preferences) setPreferences(mergePreferences(data.preferences));
      return true;
    } catch {
      toast.error('Failed to sync notification preferences');
      return false;
    }
  }, [address, mergePreferences]);

  // Initial fetch, SSE real-time stream subscription, and relaxed background heartbeat sync
  useEffect(() => {
    fetchNotifications();
    fetchPreferences();

    if (!address) return;

    // Connect to Server-Sent Events (SSE) Push Gateway
    let eventSource: EventSource | null = null;
    try {
      const apiUrl = getApiUrl();
      const queryToken = token ? `?token=${encodeURIComponent(token)}` : '';
      const streamUrl = `${apiUrl}/api/notifications/stream/${encodeURIComponent(address)}${queryToken}`;

      eventSource = new EventSource(streamUrl, { withCredentials: true });

      // Handle real-time pushed notification
      eventSource.addEventListener('notification', (e) => {
        try {
          const newNotification: NotificationItem = JSON.parse(e.data);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });
          setUnreadCount((prev) => prev + 1);

          if (newNotification.type === 'escrow_final_release') celebrateEscrow();

          toast.info(newNotification.title || 'New Notification', {
            description: newNotification.message,
          });
        } catch (err) {
          console.error('Error parsing real-time notification payload:', err);
        }
      });

      // Handle real-time unread count sync
      eventSource.addEventListener('unread_count', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (typeof payload.count === 'number') {
            setUnreadCount(payload.count);
          }
        } catch (err) {
          console.error('Error parsing unread count payload:', err);
        }
      });

      eventSource.onerror = () => {
        // Browser EventSource automatically attempts reconnection
      };
    } catch (err) {
      console.warn('Real-time SSE notification stream could not be established:', err);
    }

    // Relaxed background polling every 60s as a resilient fallback
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 60000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [address, token, fetchNotifications, fetchPreferences]);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    if (!id) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        throw new Error('Failed to update notification');
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Re-fetch on error to sync with server
      fetchNotifications(true);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!address || unreadCount === 0) return;

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/notifications/read-all/${encodeURIComponent(address)}`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        throw new Error('Failed to mark all as read');
      }
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      fetchNotifications(true);
    }
  };

  // Delete notification
  const removeNotification = async (id: string) => {
    if (!id) return;

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => {
      const target = notifications.find((n) => n.id === id);
      return target && !target.is_read ? Math.max(0, prev - 1) : prev;
    });

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete notification');
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
      fetchNotifications(true);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => getNotificationCategory(n) === activeTab);
  }, [notifications, activeTab]);

  const unreadCountsByCategory = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: 0,
      escrow: 0,
      proposals: 0,
      disputes: 0,
      system: 0,
    };
    notifications.forEach((item) => {
      if (!item.is_read) {
        counts.all += 1;
        const cat = getNotificationCategory(item);
        if (cat in counts) {
          counts[cat] += 1;
        }
      }
    });
    return counts;
  }, [notifications]);

  return {
    notifications,
    filteredNotifications,
    unreadCount,
    unreadCountsByCategory,
    activeTab,
    setActiveTab,
    loading,
    preferences,
    preferencesLoading,
    savePreferences,
    refreshPreferences: fetchPreferences,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh: () => fetchNotifications(false),
  };
}
