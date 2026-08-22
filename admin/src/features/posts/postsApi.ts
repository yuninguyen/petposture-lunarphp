import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, fetchJson } from '@/lib/api';

export interface Post {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  type: 'article' | 'guide' | 'comparison';
  blog_category: { id: string; name: string } | null;
  has_out_of_stock_comparison_items: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostsPage {
  data: Post[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface PostsFilters {
  search?: string;
  status?: 'draft' | 'published';
  category?: string;
  type?: 'article' | 'guide' | 'comparison';
  page?: number;
}

export function buildPostsQuery(filters: PostsFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.type) params.set('type', filters.type);
  if (filters.page) params.set('page', String(filters.page));
  const qs = params.toString();
  return qs ? `/admin/posts?${qs}` : '/admin/posts';
}

export function usePosts(filters: PostsFilters = {}) {
  return useQuery({
    queryKey: ['posts', filters],
    queryFn: () => fetchJson<PostsPage>(buildPostsQuery(filters)),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/admin/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete post');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
export interface AffiliateNetwork {
  name: string;
  slug: string;
}

export function extractAffiliateNetworks(input: AffiliateNetwork[] | undefined | null): AffiliateNetwork[] {
  return input ?? [];
}

export function useAffiliateNetworks() {
  return useQuery({
    queryKey: ['affiliate-networks'],
    queryFn: async () => extractAffiliateNetworks(await fetchJson<AffiliateNetwork[]>('/admin/affiliate-networks')),
  });
}

export interface TaxonomyOption {
  id: string;
  name: string;
}

export function useBreeds() {
  return useQuery({
    queryKey: ['breeds'],
    queryFn: async () => {
      const res = await fetchJson<{ data: TaxonomyOption[] }>('/breeds');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useSolutions() {
  return useQuery({
    queryKey: ['solutions'],
    queryFn: async () => {
      const res = await fetchJson<{ data: TaxonomyOption[] }>('/solutions');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useBlogTags() {
  return useQuery({
    queryKey: ['blog-tags'],
    queryFn: async () => {
      const res = await fetchJson<TaxonomyOption[]>('/admin/blog/tags');
      return Array.isArray(res) ? res : [];
    },
  });
}

export function useBulkDeletePosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetchApi('/admin/posts/bulk-delete', { method: 'POST', body: { ids } });
      if (!res.ok) {
        throw new Error('Failed to delete posts');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useDuplicatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ data: Post }>(`/admin/posts/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useGenerateSeo() {
  return useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      fetchJson<{
        seo_title: string;
        focus_keyphrase: string;
        meta_description: string;
        social_title: string;
        social_description: string;
      }>('/admin/posts/generate-seo', { method: 'POST', body: payload }),
  });
}

export interface UserOption {
  id: string;
  name: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetchJson<UserOption[]>('/admin/users');
      return Array.isArray(res) ? res : [];
    },
  });
}

export interface CreatedCategory {
  id: string;
  name: string;
  slug: string;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<CreatedCategory>('/admin/blog/categories', { method: 'POST', body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
    },
  });
}

export interface CreatedTag {
  id: string;
  name: string;
  slug: string;
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<CreatedTag>('/admin/blog/tags', { method: 'POST', body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
    },
  });
}

// The storefront base URL comes from the backend (config('app.frontend_url'),
// exposed via GET /api/settings) — the SAME value the preview endpoint uses —
// so admin View links always target the right frontend for the environment.
export function useFrontendUrl() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetchJson<{ data: { frontend_url?: string } }>('/settings');
      return res.data?.frontend_url ?? null;
    },
    staleTime: Infinity,
  });
}
