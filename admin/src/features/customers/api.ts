import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  orders_count: number;
  orders_sum_total: number | null;
  created_at: string | null;
  status: 'active' | 'inactive';
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
