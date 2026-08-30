import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import { buildCustomersQuery, fetchCustomer, fetchCustomerAddresses, fetchCustomerLoginAccounts, fetchCustomerOrders, fetchCustomers, type CustomerAddress } from './api';

describe('customers api', () => {
  it('serializes trimmed optional list filters exactly', () => {
    expect(buildCustomersQuery({})).toBe('/admin/customers');
    expect(buildCustomersQuery({ search: '  Taylor Customer  ', status: 'inactive', page: 2 }))
      .toBe('/admin/customers?search=Taylor+Customer&status=inactive&page=2');
  });

  it('requests the list endpoint with its serialized filters', async () => {
    const page = { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } };
    mocks.fetchJson.mockResolvedValueOnce(page);

    await expect(fetchCustomers({ search: 'Taylor', status: 'active', page: 3 })).resolves.toEqual(page);
    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/customers?search=Taylor&status=active&page=3');
  });

  it('requests only Task 2 read endpoints for customer detail data', async () => {
    mocks.fetchJson.mockReset();
    const summary = { id: 42, name: 'Taylor', email: null, orders_count: 0, orders_sum_total: null, created_at: null, status: 'active' as const };
    const orders = { data: [], meta: { current_page: 2, last_page: 2, per_page: 15, total: 16 } };
    const addresses: CustomerAddress[] = [];
    const accounts = [{ id: 7, email: 'login@example.com' }];
    mocks.fetchJson.mockResolvedValueOnce({ data: summary }).mockResolvedValueOnce(orders).mockResolvedValueOnce({ data: addresses }).mockResolvedValueOnce({ data: accounts });

    await expect(fetchCustomer('42')).resolves.toEqual(summary);
    await expect(fetchCustomerOrders('42', 2)).resolves.toEqual(orders);
    await expect(fetchCustomerAddresses('42')).resolves.toEqual(addresses);
    await expect(fetchCustomerLoginAccounts('42')).resolves.toEqual(accounts);
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/customers/42');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/customers/42/orders?page=2');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/customers/42/addresses');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(4, '/admin/customers/42/login-accounts');
    expect(mocks.fetchJson.mock.calls).toHaveLength(4);
    for (const call of mocks.fetchJson.mock.calls) expect(call).toHaveLength(1);
  });
});
