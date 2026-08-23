import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Breed {
  id: number;
  name: string;
  slug: string;
  body_type: string | null;
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

interface BreedsResponse {
  data: Breed[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export function useBreeds(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: ['breeds', params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.page) q.set('page', params.page.toString());
      return fetchJson<BreedsResponse>(`/admin/breeds?${q.toString()}`);
    },
    keepPreviousData: true,
  });
}

export function useBreed(id: number | string | undefined) {
  return useQuery({
    queryKey: ['breeds', id],
    queryFn: () => fetchJson<{ data: Breed }>(`/admin/breeds/${id}`),
    enabled: !!id,
  });
}

export function useCreateBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Breed>) =>
      fetchJson<{ data: Breed }>('/admin/breeds', {
        method: 'POST',
        body: data as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['breeds'] });
    },
  });
}

export function useUpdateBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Breed> }) =>
      fetchJson<{ data: Breed }>(`/admin/breeds/${id}`, {
        method: 'PUT',
        body: data as any,
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['breeds'] });
      qc.invalidateQueries({ queryKey: ['breeds', variables.id] });
      qc.invalidateQueries({ queryKey: ['breeds', variables.id.toString()] });
    },
  });
}

export function useDeleteBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson(`/admin/breeds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['breeds'] });
    },
  });
}

export function useBulkDeleteBreeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      fetchJson('/admin/breeds/bulk-delete', {
        method: 'POST',
        body: { ids },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['breeds'] });
    },
  });
}
