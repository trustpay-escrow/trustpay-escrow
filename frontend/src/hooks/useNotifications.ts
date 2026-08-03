import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { NotificationItem } from '@/types/notification';
import { toast } from 'sonner';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useNotifications() {
  const { address } = useWalletStore();
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
      const res = await fetch(`${apiUrl}/api/notifications/${encodeURIComponent(address)}`);
      
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

  // Initial fetch and periodic polling
  useEffect(() => {
    fetchNotifications();

    if (!address) return;

    // Poll every 12 seconds for new notifications
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 12000);

    return () => clearInterval(interval);
  }, [address, fetchNotifications]);

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
      const res = await fetch(`${apiUrl}/api/notifications/${id}/read`, {
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
      const res = await fetch(`${apiUrl}/api/notifications/read-all/${encodeURIComponent(address)}`, {
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
      const res = await fetch(`${apiUrl}/api/notifications/${id}`, {
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
