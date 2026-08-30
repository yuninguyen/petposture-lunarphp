import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface ShippingMethod {
  id: number;
  code: string;
  name: string;
  eta: string | null;
  price: string | number;
  free_over: string | number | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingMethodFormValues {
  code: string;
  name: string;
  eta: string;
  price: string;
  free_over: string;
}

export interface ShippingMethodCreatePayload extends Record<string, unknown> {
  code: string;
  name: string;
  eta: string | null;
  price: number;
  free_over: number | null;
}

export interface ShippingMethodUpdatePayload extends Record<string, unknown> {
  name: string;
  eta: string | null;
  price: number;
  free_over: number | null;
}

type ShippingMethodResponse = ShippingMethod | { data: ShippingMethod };
type ShippingMethodsResponse = ShippingMethod[] | { data: ShippingMethod[] };

export function normalizeShippingMethodsResponse(response: ShippingMethodsResponse): ShippingMethod[] {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeShippingMethodResponse(response: ShippingMethodResponse): ShippingMethod {
  return 'data' in response ? response.data : response;
}

function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

export function buildShippingMethodCreatePayload(values: ShippingMethodFormValues): ShippingMethodCreatePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    eta: values.eta.trim() || null,
    price: Number(values.price),
    free_over: optionalNumber(values.free_over),
  };
}

export function buildShippingMethodUpdatePayload(values: ShippingMethodFormValues): ShippingMethodUpdatePayload {
  return {
    name: values.name.trim(),
    eta: values.eta.trim() || null,
    price: Number(values.price),
    free_over: optionalNumber(values.free_over),
  };
}

export async function fetchShippingMethods(): Promise<ShippingMethod[]> {
  return normalizeShippingMethodsResponse(await fetchJson<ShippingMethodsResponse>('/admin/shipping-methods'));
}

export async function createShippingMethod(payload: ShippingMethodCreatePayload): Promise<ShippingMethod> {
  return normalizeShippingMethodResponse(await fetchJson<ShippingMethodResponse>('/admin/shipping-methods', { method: 'POST', body: payload }));
}

export async function updateShippingMethod(id: number, payload: ShippingMethodUpdatePayload): Promise<ShippingMethod> {
  return normalizeShippingMethodResponse(await fetchJson<ShippingMethodResponse>(`/admin/shipping-methods/${id}`, { method: 'PUT', body: payload }));
}

export async function deleteShippingMethod(id: number): Promise<void> {
  await fetchJson(`/admin/shipping-methods/${id}`, { method: 'DELETE' });
}

export function useShippingMethods() {
  return useQuery({ queryKey: ['shipping-methods'], queryFn: fetchShippingMethods });
}

function useShippingMethodMutation<T>(mutationFn: (variables: T) => Promise<ShippingMethod>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipping-methods'] }),
  });
}

export function useCreateShippingMethod() {
  return useShippingMethodMutation(createShippingMethod);
}

export function useUpdateShippingMethod() {
  return useShippingMethodMutation(({ id, payload }: { id: number; payload: ShippingMethodUpdatePayload }) => updateShippingMethod(id, payload));
}

export function useDeleteShippingMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteShippingMethod,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipping-methods'] }),
  });
}
