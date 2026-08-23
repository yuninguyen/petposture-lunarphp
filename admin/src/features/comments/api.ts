import { fetchJson, fetchApi } from '@/lib/api';

export interface Comment {
  id: number;
  post_id: number;
  post: {
    id: number;
    title: string;
  };
  customer_name: string;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export async function fetchComments(
  page: number, 
  search: string = '', 
  status: string = ''
): Promise<PaginatedResponse<Comment>> {
  const query = new URLSearchParams({
    page: page.toString(),
    per_page: '10',
  });
  if (search) query.append('search', search);
  if (status) query.append('status', status);

  return fetchJson(`/admin/comments?${query.toString()}`);
}

export async function fetchComment(id: number): Promise<{ data: Comment }> {
  return fetchJson(`/admin/comments/${id}`);
}

export async function createComment(data: Partial<Comment>): Promise<Comment> {
  const res = await fetchJson<{ data: Comment }>('/admin/comments', {
    method: 'POST',
    body: data as Record<string, unknown>,
  });
  return res.data;
}

export async function updateComment(id: number, data: Partial<Comment>): Promise<Comment> {
  const res = await fetchJson<{ data: Comment }>(`/admin/comments/${id}`, {
    method: 'PUT',
    body: data as Record<string, unknown>,
  });
  return res.data;
}

export async function deleteComment(id: number): Promise<void> {
  const res = await fetchApi(`/admin/comments/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data?.message ?? 'Failed to delete comment'), { status: res.status, data });
  }
}

export async function bulkDeleteComments(ids: number[]): Promise<void> {
  const res = await fetchApi('/admin/comments/bulk-delete', {
    method: 'POST',
    body: { ids } as Record<string, unknown>,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data?.message ?? 'Failed to delete comments'), { status: res.status, data });
  }
}

export async function approveComment(id: number): Promise<{ data: Comment }> {
  return fetchJson(`/admin/comments/${id}/approve`, {
    method: 'POST',
  });
}
