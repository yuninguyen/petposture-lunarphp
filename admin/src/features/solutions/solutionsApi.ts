import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Solution {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  featured_image: string | null;
  featured_image_alt: string | null;
  featured_media_id: number | null;
  featured_media?: {
    id: number;
    url: string;
    alt: string | null;
  } | null;
  products_count?: number;
  posts_count?: number;
  products?: Array<{ id: number; name?: string; title?: string; slug: string }>;
  posts?: Array<{ id: number; title: string; slug: string }>;
  seo?: {
    title?: string | null;
    description?: string | null;
    keyphrase?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    og_image?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

interface SolutionsResponse {
  data: Solution[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export function useSolutions(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: ['solutions', params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.page) q.set('page', params.page.toString());
      return fetchJson<SolutionsResponse>(`/admin/solutions?${q.toString()}`);
    },
    keepPreviousData: true,
  });
}

export function useSolution(id: number | string | undefined) {
  return useQuery({
    queryKey: ['solutions', id],
    queryFn: () => fetchJson<{ data: Solution }>(`/admin/solutions/${id}`),
    enabled: !!id,
  });
}

export function useCreateSolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Solution>) =>
      fetchJson<{ data: Solution }>('/admin/solutions', {
        method: 'POST',
        body: data as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solutions'] });
    },
  });
}

export function useUpdateSolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Solution> }) =>
      fetchJson<{ data: Solution }>(`/admin/solutions/${id}`, {
        method: 'PUT',
        body: data as any,
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['solutions'] });
      qc.invalidateQueries({ queryKey: ['solutions', variables.id] });
      qc.invalidateQueries({ queryKey: ['solutions', variables.id.toString()] });
    },
  });
}

export function useDeleteSolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/admin/solutions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solutions'] });
    },
  });
}

export function useBulkDeleteSolutions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      fetchJson('/admin/solutions/bulk-delete', {
        method: 'POST',
        body: { ids },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solutions'] });
    },
  });
}
