import { authFetch } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { NotificationItem } from '@/types/notification';
import { toast } from 'sonner';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useNotifications() {
  const { address, token } = useWalletStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

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
    } catch (err: any) {
      if (!silent) {
        console.error('Error loading notifications:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [address]);

  // Initial fetch, SSE real-time stream subscription, and relaxed background heartbeat sync
  useEffect(() => {
    fetchNotifications();

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
  }, [address, token, fetchNotifications]);

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

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh: () => fetchNotifications(false),
  };
}
