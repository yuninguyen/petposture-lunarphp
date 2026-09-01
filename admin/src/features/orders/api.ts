import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface OrderMoney { formatted: string; decimal: number; currency: string }
export interface OrderAddress { first_name?: string | null; last_name?: string | null; line_one?: string | null; line_two?: string | null; city?: string | null; state?: string | null; postcode?: string | null; country?: string | null; phone?: string | null }
export interface OrderLine { id: number; type: string; description: string; quantity: number; unit_price: number; sub_total: number; discount_total: number; tax_total: number; total: number; image: string | null }
export interface OrderEvent { type: string; title: string; detail: string | null; created_at: string | null }
export interface OrderAction { action: string; label: string }
export interface RefundReasonOption { value: string; label: string }
export type ShipmentCarrier = 'manual' | 'ups' | 'usps' | 'fedex' | 'dhl';
export interface CreateShipmentPayload { tracking_number: string; shipment_carrier: ShipmentCarrier; items: Array<{ order_line_id: number; quantity: number }> }
export interface RefundPayload { amount?: number; reason: string }
export interface Order {
  id: string; reference: string; status: string; status_label?: string | null; payment_status: string; payment_status_label?: string | null; fulfillment_status: string; fulfillment_status_label?: string | null; customer_email: string | null; coupon_code?: string | null; refund_status?: string | null; refund_amount?: number | null; refunded_at?: string | null; returned_at?: string | null; sub_total?: number; discount_total?: number; shipping_total?: number; shipping_label?: string | null; tax_total?: number; attribution_origin?: string | null; attribution_device_type?: string | null; attribution_session_page_views?: number | null; fraud_risk_level?: string | null; fraud_risk_score?: number | null; fraud_seller_message?: string | null; total: OrderMoney; created_at: string | null; lines?: OrderLine[]; shipping_address?: OrderAddress; billing_address?: OrderAddress; order_events?: OrderEvent[];
  available_actions?: OrderAction[]; remaining_shippable_quantities: Record<string, number>; refund_reason_options: RefundReasonOption[];
}
export interface OrdersPage { data: Order[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface OrderFilters { status?: string; page?: number }

export function buildOrdersQuery(filters: OrderFilters): string {
  const params = new URLSearchParams();
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  if (filters.page) params.set('page', String(filters.page));
  const query = params.toString();
  return `/admin/orders${query ? `?${query}` : ''}`;
}

function unwrap<T>(response: T | { data: T }): T { return 'data' in (response as object) ? (response as { data: T }).data : response as T; }
export async function fetchOrders(filters: OrderFilters): Promise<OrdersPage> { return fetchJson(buildOrdersQuery(filters)); }
export async function fetchOrder(id: string): Promise<Order> { return unwrap(await fetchJson<Order | { data: Order }>(`/admin/orders/${id}`)); }
export async function performOrderAction(id: string, action: string): Promise<Order> { return unwrap(await fetchJson<Order | { data: Order }>(`/orders/${id}/actions/${action}`, { method: 'POST' })); }
export async function createShipment(id: string, payload: CreateShipmentPayload): Promise<Order> { return unwrap(await fetchJson<Order | { data: Order }>(`/orders/${id}/shipments`, { method: 'POST', body: payload as unknown as Record<string, unknown> })); }
export async function refundOrder(id: string, payload: RefundPayload): Promise<Order> { return unwrap(await fetchJson<Order | { data: Order }>(`/admin/orders/${id}/refund`, { method: 'POST', body: payload as unknown as Record<string, unknown> })); }
export async function returnOrder(id: string): Promise<Order> { return unwrap(await fetchJson<Order | { data: Order }>(`/admin/orders/${id}/return`, { method: 'POST' })); }

export function useOrders(filters: OrderFilters) { return useQuery({ queryKey: ['orders', filters], queryFn: () => fetchOrders(filters) }); }
export function useOrder(id?: string) { return useQuery({ queryKey: ['orders', id], queryFn: () => fetchOrder(id!), enabled: Boolean(id) }); }
function useOrderMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Order>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: (order) => { queryClient.setQueryData(['orders', order.id], order); queryClient.invalidateQueries({ queryKey: ['orders'] }); } });
}
export function useOrderAction() { return useOrderMutation(({ id, action }: { id: string; action: string }) => performOrderAction(id, action)); }
export function useCreateShipment() { return useOrderMutation(({ id, payload }: { id: string; payload: CreateShipmentPayload }) => createShipment(id, payload)); }
export function useRefundOrder() { return useOrderMutation(({ id, amount, reason }: { id: string; amount?: number; reason: string }) => refundOrder(id, { amount, reason })); }
export function useReturnOrder() { return useOrderMutation(({ id }: { id: string }) => returnOrder(id)); }
