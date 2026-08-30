import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export type ReturnRequestStatus = 'requested' | 'approved' | 'rejected' | 'completed';
export interface ReturnRequestItem { order_line_id: string; description: string | null; option: string | null; quantity: number }
export interface ReturnRequest {
  id: string;
  order_reference: string | null;
  status: ReturnRequestStatus;
  reason: string;
  customer_note: string | null;
  admin_note: string | null;
  rma_address: string | null;
  refund_amount: number | null;
  restocking_fee: number | null;
  fee_waived: boolean;
  requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  items: ReturnRequestItem[];
}
export interface ReturnRequestsPage { data: ReturnRequest[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface ReturnRequestFilters { status?: string; page?: number }
export interface ApproveReturnRequestPayload extends Record<string, unknown> { rma_address: string; fee_waived?: boolean; refund_amount?: number; admin_note?: string }
export interface RejectReturnRequestPayload extends Record<string, unknown> { admin_note?: string }

export function buildReturnRequestsQuery(filters: ReturnRequestFilters): string {
  const params = new URLSearchParams();
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  if (filters.page) params.set('page', String(filters.page));
  const query = params.toString();
  return `/admin/return-requests${query ? `?${query}` : ''}`;
}

function unwrap<T>(response: T | { data: T }): T { return 'data' in (response as object) ? (response as { data: T }).data : response as T; }
export async function fetchReturnRequests(filters: ReturnRequestFilters): Promise<ReturnRequestsPage> { return fetchJson(buildReturnRequestsQuery(filters)); }
export async function fetchReturnRequest(id: string): Promise<ReturnRequest> { return unwrap(await fetchJson<ReturnRequest | { data: ReturnRequest }>(`/admin/return-requests/${id}`)); }
export async function approveReturnRequest(id: string, payload: ApproveReturnRequestPayload): Promise<ReturnRequest> { return unwrap(await fetchJson<ReturnRequest | { data: ReturnRequest }>(`/admin/return-requests/${id}/approve`, { method: 'POST', body: payload })); }
export async function rejectReturnRequest(id: string, payload: RejectReturnRequestPayload): Promise<ReturnRequest> { return unwrap(await fetchJson<ReturnRequest | { data: ReturnRequest }>(`/admin/return-requests/${id}/reject`, { method: 'POST', body: payload })); }
export async function completeReturnRequest(id: string): Promise<ReturnRequest> { return unwrap(await fetchJson<ReturnRequest | { data: ReturnRequest }>(`/admin/return-requests/${id}/complete`, { method: 'POST' })); }

export function useReturnRequests(filters: ReturnRequestFilters) { return useQuery({ queryKey: ['return-requests', filters], queryFn: () => fetchReturnRequests(filters) }); }
export function useReturnRequest(id?: string) { return useQuery({ queryKey: ['return-requests', id], queryFn: () => fetchReturnRequest(id!), enabled: Boolean(id) }); }
function useReturnRequestMutation<T>(mutationFn: (variables: T) => Promise<ReturnRequest>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: (request) => { queryClient.setQueryData(['return-requests', request.id], request); queryClient.invalidateQueries({ queryKey: ['return-requests'] }); } });
}
export function useApproveReturnRequest() { return useReturnRequestMutation(({ id, payload }: { id: string; payload: ApproveReturnRequestPayload }) => approveReturnRequest(id, payload)); }
export function useRejectReturnRequest() { return useReturnRequestMutation(({ id, payload }: { id: string; payload: RejectReturnRequestPayload }) => rejectReturnRequest(id, payload)); }
export function useCompleteReturnRequest() { return useReturnRequestMutation(({ id }: { id: string }) => completeReturnRequest(id)); }
