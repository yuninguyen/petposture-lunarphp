import { fetchJson, fetchApi } from '@/lib/api';

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  posts_count: number;
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

export async function fetchBlogCategories(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<BlogCategory>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', String(params.page));
  if (params?.search) searchParams.append('search', params.search);
  
  const qs = searchParams.toString();
  return fetchJson<PaginatedResponse<BlogCategory>>(`/admin/blog/categories${qs ? '?' + qs : ''}`);
}

export async function createBlogCategory(
  payload: Partial<BlogCategory>
): Promise<{ data: BlogCategory }> {
  return fetchJson<{ data: BlogCategory }>('/admin/blog/categories', {
    method: 'POST',
    body: payload,
  });
}

export async function updateBlogCategory(
  id: number,
  payload: Partial<BlogCategory>
): Promise<{ data: BlogCategory }> {
  return fetchJson<{ data: BlogCategory }>(`/admin/blog/categories/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteBlogCategory(id: number): Promise<void> {
  const res = await fetchApi(`/admin/blog/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data?.message ?? 'Failed to delete category'), { status: res.status, data });
  }
}

export async function bulkDeleteBlogCategories(ids: number[]): Promise<void> {
  const res = await fetchApi('/admin/blog/categories/bulk-delete', {
    method: 'POST',
    body: { ids },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data?.message ?? 'Failed to delete categories'), { status: res.status, data });
  }
}
