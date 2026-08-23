import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string | null;
  meta_description?: string | null;
  is_active: boolean;
  is_core: boolean;
  status: 'draft' | 'invisible' | 'published';
  created_at: string;
  updated_at: string;
}

export interface PaginatedPages {
  data: Page[];
  current_page: number;
  last_page: number;
  total: number;
}

export function usePages(page = 1, search = '') {
  return useQuery({
    queryKey: ['pages', page, search],
    queryFn: () => fetchJson<PaginatedPages>(`/admin/pages?page=${page}&search=${encodeURIComponent(search)}`),
  });
}

export function usePage(id: string) {
  return useQuery({
    queryKey: ['pages', id],
    queryFn: () => fetchJson<Page>(`/admin/pages/${id}`),
    enabled: !!id,
  });
}

export function useCreatePage() {
  return useMutation({
    mutationFn: (data: Partial<Page>) => fetchJson<Page>('/admin/pages', {
      method: 'POST',
      body: data,
    }),
  });
}

export function useUpdatePage() {
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Page> & { id: number }) => fetchJson<Page>(`/admin/pages/${id}`, {
      method: 'PUT',
      body: data,
    }),
  });
}

export function useDeletePage() {
  return useMutation({
    mutationFn: (id: number) => fetchJson(`/admin/pages/${id}`, {
      method: 'DELETE',
    }),
  });
}

export function useBulkDeletePages() {
  return useMutation({
    mutationFn: (ids: number[]) => fetchJson('/admin/pages/bulk-delete', {
      method: 'POST',
      body: { ids },
    }),
  });
}
