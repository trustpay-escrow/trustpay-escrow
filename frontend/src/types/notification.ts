export type NotificationCategory = 'all' | 'escrow' | 'proposals' | 'disputes' | 'system';

export interface NotificationItem {
  id: string;
  recipient_address: string;
  sender_address?: string | null;
  project_id?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  category?: NotificationCategory;
}

export function getNotificationCategory(item: NotificationItem): 'escrow' | 'proposals' | 'disputes' | 'system' {
  if (item.category && item.category !== 'all') {
    return item.category;
  }
  const t = (item.type || '').toLowerCase();
  if (t.includes('proposal')) return 'proposals';
  if (t.includes('dispute') || t.includes('arbit')) return 'disputes';
  if (
    t.includes('milestone') ||
    t.includes('escrow') ||
    t.includes('payment') ||
    t.includes('deposit') ||
    t.includes('release') ||
    t.includes('fund')
  ) {
    return 'escrow';
  }
  return 'system';
}
