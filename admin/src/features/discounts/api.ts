import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export const AMOUNT_OFF_TYPE = 'Lunar\\DiscountTypes\\AmountOff' as const;

export type DiscountType = typeof AMOUNT_OFF_TYPE;
export type DiscountStatus = 'active' | 'expired' | 'pending' | 'scheduled';

export interface DiscountData {
  min_prices: { USD: number | null };
  fixed_value?: boolean;
  percentage?: number | null;
  fixed_values?: { USD: number | null };
}

export interface Discount {
  id: number;
  name: string;
  handle: string;
  coupon: string | null;
  type: DiscountType;
  type_label: string;
  supported: boolean;
  status: DiscountStatus;
  starts_at: string;
  ends_at: string | null;
  uses: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  priority: number | null;
  stop: boolean;
  data: DiscountData;
  created_at: string;
  updated_at: string;
}

export interface DiscountPage {
  data: Discount[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface DiscountFilters {
  search?: string;
  page?: number;
}

export interface DiscountCreatePayload {
  name: string;
  handle: string;
  type: DiscountType;
  starts_at: string;
  ends_at: string | null;
  coupon: string;
  priority: number | null;
  stop: boolean;
  max_uses: number | null;
  max_uses_per_user: number | null;
  data: DiscountData;
}

export type DiscountUpdatePayload = Required<Pick<DiscountCreatePayload, 'name' | 'handle' | 'type' | 'starts_at' | 'ends_at' | 'coupon' | 'priority' | 'stop' | 'max_uses' | 'max_uses_per_user' | 'data'>>;

export interface DiscountFormValues {
  name: string;
  handle: string;
  starts_at: string;
  ends_at: string;
  coupon: string;
  priority: string;
  stop: boolean;
  max_uses: string;
  max_uses_per_user: string;
  min_price_usd: string;
  fixed_value: boolean;
  percentage: string;
  fixed_value_usd: string;
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function discountData(values: DiscountFormValues): DiscountData {
  const min_prices = { USD: optionalNumber(values.min_price_usd) };

  return values.fixed_value
    ? { min_prices, fixed_value: true, fixed_values: { USD: optionalNumber(values.fixed_value_usd) } }
    : { min_prices, fixed_value: false, percentage: optionalNumber(values.percentage) };
}

export function toIsoUtc(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toLocalDateTimeValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildDiscountPayload(values: DiscountFormValues): DiscountCreatePayload | null {
  const starts_at = toIsoUtc(values.starts_at);
  const ends_at = values.ends_at.trim() === '' ? null : toIsoUtc(values.ends_at);
  if (starts_at === null || ends_at === null && values.ends_at.trim() !== '') return null;

  return {
    name: values.name.trim(),
    handle: values.handle.trim(),
    type: AMOUNT_OFF_TYPE,
    starts_at,
    ends_at,
    coupon: values.coupon.trim(),
    priority: optionalNumber(values.priority),
    stop: values.stop,
    max_uses: optionalNumber(values.max_uses),
    max_uses_per_user: optionalNumber(values.max_uses_per_user),
    data: discountData(values),
  };
}

export function buildDiscountUpdatePayload(values: DiscountFormValues): DiscountUpdatePayload | null {
  const payload = buildDiscountPayload(values);
  return payload && { ...payload, handle: values.handle.trim() };
}

export async function fetchDiscounts(filters: DiscountFilters = {}): Promise<DiscountPage> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.page && filters.page > 0) params.set('page', String(filters.page));
  const query = params.toString();
  return fetchJson<DiscountPage>(`/admin/discounts${query ? `?${query}` : ''}`);
}

export async function fetchDiscount(id: number): Promise<Discount> {
  const response = await fetchJson<{ data: Discount }>(`/admin/discounts/${id}`);
  return response.data;
}

export async function createDiscount(payload: DiscountCreatePayload): Promise<Discount> {
  const response = await fetchJson<{ data: Discount }>('/admin/discounts', { method: 'POST', body: { ...payload } });
  return response.data;
}

export async function updateDiscount(id: number, payload: DiscountUpdatePayload): Promise<Discount> {
  const response = await fetchJson<{ data: Discount }>(`/admin/discounts/${id}`, { method: 'PUT', body: { ...payload } });
  return response.data;
}

export async function deleteDiscount(id: number): Promise<void> {
  await fetchJson(`/admin/discounts/${id}`, { method: 'DELETE' });
}

export function useDiscounts(filters: DiscountFilters = {}) {
  return useQuery({ queryKey: ['discounts', filters], queryFn: () => fetchDiscounts(filters) });
}

export function useDiscount(id?: number) {
  return useQuery({ queryKey: ['discount', id], queryFn: () => fetchDiscount(id!), enabled: Boolean(id) });
}

function useDiscountMutation<T>(mutationFn: (variables: T) => Promise<Discount>, detailId: (result: Discount, variables: T) => number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (discount, variables) => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discount', detailId(discount, variables)] });
    },
  });
}

export function useCreateDiscount() {
  return useDiscountMutation(createDiscount, (discount) => discount.id);
}

export function useUpdateDiscount() {
  return useDiscountMutation(({ id, payload }: { id: number; payload: DiscountUpdatePayload }) => updateDiscount(id, payload), (_discount, variables) => variables.id);
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscount,
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discount', id] });
    },
  });
}
