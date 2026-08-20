import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Post {
  id: string;
  title: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  created_at: string;
  published_at: string | null;
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () => fetchJson<{ data: Post[] }>('/admin/posts').then((res) => res.data),
  });
}
