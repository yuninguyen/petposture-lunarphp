import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, fetchJson } from '@/lib/api';

export interface Post {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
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
  page?: number;
}

export function buildPostsQuery(filters: PostsFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
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
