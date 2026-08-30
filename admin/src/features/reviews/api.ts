import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewProduct {
  id: number;
  name: string;
}

export interface Review {
  id: number;
  product: ReviewProduct | null;
  customer_name: string;
  customer_email: string | null;
  rating: number;
  comment: string;
  is_verified: boolean;
  status: ReviewStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReviewPage {
  data: Review[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReviewFilters {
  status?: string;
  productId?: number;
  page?: number;
}

export interface ReviewUpdatePayload extends Record<string, unknown> {
  status: ReviewStatus;
  rating: number;
  comment: string;
  customer_name: string;
}

function unwrap<T>(response: T | { data: T }): T {
  return 'data' in (response as object) ? (response as { data: T }).data : response as T;
}

export function buildReviewsQuery(filters: ReviewFilters): string {
  const params = new URLSearchParams();
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  if (filters.productId) params.set('product_id', String(filters.productId));
  if (filters.page) params.set('page', String(filters.page));
  const query = params.toString();
  return `/admin/reviews${query ? `?${query}` : ''}`;
}

export async function fetchReviews(filters: ReviewFilters): Promise<ReviewPage> {
  return fetchJson<ReviewPage>(buildReviewsQuery(filters));
}

export async function fetchReviewProducts(search: string): Promise<ReviewProduct[]> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  return unwrap(await fetchJson<ReviewProduct[] | { data: ReviewProduct[] }>(`/admin/reviews/products${query.size ? `?${query}` : ''}`));
}

export async function fetchReview(id: number): Promise<Review> {
  return unwrap(await fetchJson<Review | { data: Review }>(`/admin/reviews/${id}`));
}

export async function updateReview(id: number, payload: ReviewUpdatePayload): Promise<Review> {
  return unwrap(await fetchJson<Review | { data: Review }>(`/admin/reviews/${id}`, { method: 'PATCH', body: payload }));
}

export async function deleteReview(id: number): Promise<void> {
  await fetchJson(`/admin/reviews/${id}`, { method: 'DELETE' });
}

export function useReviews(filters: ReviewFilters) {
  return useQuery({ queryKey: ['reviews', filters], queryFn: () => fetchReviews(filters) });
}

export function useReviewProducts(search: string) {
  return useQuery({ queryKey: ['review-products', search], queryFn: () => fetchReviewProducts(search) });
}

export function useReview(id?: number) {
  return useQuery({ queryKey: ['reviews', id], queryFn: () => fetchReview(id!), enabled: Boolean(id) });
}

function useReviewMutation<T>(mutationFn: (variables: T) => Promise<Review>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (review) => {
      queryClient.setQueryData(['reviews', review.id], review);
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useUpdateReview() {
  return useReviewMutation(({ id, payload }: { id: number; payload: ReviewUpdatePayload }) => updateReview(id, payload));
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  });
}
