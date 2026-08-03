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
}
