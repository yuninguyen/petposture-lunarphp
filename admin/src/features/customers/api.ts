import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Customer {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  tax_identifier?: string | null;
  email: string | null;
  phone?: string | null;
  orders_count: number;
  orders_sum_total: number | null;
  created_at: string | null;
  status: 'active' | 'inactive';
}

export interface CustomerUpdatePayload {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  tax_identifier: string | null;
}

export type CustomerAddressUpdatePayload = Pick<CustomerAddress, 'title' | 'first_name' | 'last_name' | 'line_one' | 'line_two' | 'line_three' | 'city' | 'state' | 'postcode' | 'contact_phone' | 'contact_email' | 'shipping_default' | 'billing_default'>;

export interface CustomerLoginAccountUpdatePayload {
  email: string;
  password?: string;
  password_confirmation?: string;
}

export interface CustomerListPage {
  data: Customer[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface CustomerFilters {
  search?: string;
  status?: 'active' | 'inactive';
  page?: number;
}

export function buildCustomersQuery(filters: CustomerFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  const query = params.toString();
  return `/admin/customers${query ? `?${query}` : ''}`;
}

export async function fetchCustomers(filters: CustomerFilters): Promise<CustomerListPage> {
  return fetchJson(buildCustomersQuery(filters));
}

export interface CustomerOrder {
  id: string;
  reference: string;
  status: string;
  status_label: string | null;
  total: { formatted: string; decimal: number; currency: string };
  created_at: string | null;
}

export interface CustomerAddress {
  id: number;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  line_one: string | null;
  line_two: string | null;
  line_three: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  shipping_default: boolean;
  billing_default: boolean;
  created_at: string | null;
}

export interface CustomerLoginAccount { id: number; email: string }
export interface CustomerOrdersPage { data: CustomerOrder[]; meta: CustomerListPage['meta'] }

function unwrap<T>(response: T | { data: T }): T {
  return 'data' in (response as object) ? (response as { data: T }).data : response as T;
}

export async function fetchCustomer(id: string): Promise<Customer> {
  return unwrap(await fetchJson<Customer | { data: Customer }>(`/admin/customers/${id}`));
}

export async function fetchCustomerOrders(id: string, page: number): Promise<CustomerOrdersPage> {
  return fetchJson(`/admin/customers/${id}/orders?page=${page}`);
}

export async function fetchCustomerAddresses(id: string): Promise<CustomerAddress[]> {
  return unwrap(await fetchJson<CustomerAddress[] | { data: CustomerAddress[] }>(`/admin/customers/${id}/addresses`));
}

export async function fetchCustomerLoginAccounts(id: string): Promise<CustomerLoginAccount[]> {
  return unwrap(await fetchJson<CustomerLoginAccount[] | { data: CustomerLoginAccount[] }>(`/admin/customers/${id}/login-accounts`));
}

export async function updateCustomer(id: string, payload: CustomerUpdatePayload): Promise<Customer> {
  return unwrap(await fetchJson<Customer | { data: Customer }>(`/admin/customers/${id}`, { method: 'PUT', body: payload as unknown as Record<string, unknown> }));
}

export async function updateCustomerAddress(customerId: string, addressId: number, payload: CustomerAddressUpdatePayload): Promise<CustomerAddress> {
  return unwrap(await fetchJson<CustomerAddress | { data: CustomerAddress }>(`/admin/customers/${customerId}/addresses/${addressId}`, { method: 'PUT', body: payload }));
}

export async function deleteCustomerAddress(customerId: string, addressId: number): Promise<void> {
  await fetchJson(`/admin/customers/${customerId}/addresses/${addressId}`, { method: 'DELETE' });
}

export async function updateCustomerLoginAccount(customerId: string, userId: number, payload: CustomerLoginAccountUpdatePayload): Promise<CustomerLoginAccount> {
  return unwrap(await fetchJson<CustomerLoginAccount | { data: CustomerLoginAccount }>(`/admin/customers/${customerId}/login-accounts/${userId}`, { method: 'PUT', body: payload as unknown as Record<string, unknown> }));
}

export function useCustomers(filters: CustomerFilters) {
  return useQuery({ queryKey: ['customers', filters], queryFn: () => fetchCustomers(filters) });
}

export function useCustomer(id?: string) {
  return useQuery({ queryKey: ['customers', id], queryFn: () => fetchCustomer(id!), enabled: Boolean(id) });
}

export function useCustomerOrders(id: string | undefined, page: number, enabled: boolean) {
  return useQuery({ queryKey: ['customers', id, 'orders', page], queryFn: () => fetchCustomerOrders(id!, page), enabled: Boolean(id) && enabled });
}

export function useCustomerAddresses(id: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['customers', id, 'addresses'], queryFn: () => fetchCustomerAddresses(id!), enabled: Boolean(id) && enabled });
}

export function useCustomerLoginAccounts(id: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['customers', id, 'login-accounts'], queryFn: () => fetchCustomerLoginAccounts(id!), enabled: Boolean(id) && enabled });
}
