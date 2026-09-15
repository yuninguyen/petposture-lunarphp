import { fetchJson } from '@/lib/api';

export interface AdminNotification {
  id: string;
  type: string;
  icon: string | null;
  color: string | null;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  unread_count: number;
}

export interface NotificationResponse {
  data: AdminNotification[];
  meta: NotificationMeta;
}

export async function fetchNotifications(params: {
  page?: number;
  per_page?: number;
} = {}): Promise<NotificationResponse> {
  const query = new URLSearchParams();
  if (params.page && params.page > 1) {
    query.set('page', String(params.page));
  }
  if (params.per_page && params.per_page > 0) {
    query.set('per_page', String(params.per_page));
  }

  const qs = query.toString();
  return fetchJson<NotificationResponse>(`/admin/notifications${qs ? `?${qs}` : ''}`);
}

export async function markAsRead(id: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`/admin/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllAsRead(): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>('/admin/notifications/read-all', {
    method: 'POST',
  });
}
