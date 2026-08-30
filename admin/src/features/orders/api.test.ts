import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import { buildOrdersQuery, fetchOrder, fetchOrders, refundOrder, returnOrder } from './api';

describe('orders api', () => {
  it('builds the list query with only non-empty status and page values', () => {
    expect(buildOrdersQuery({ status: '', page: 0 })).toBe('/admin/orders');
    expect(buildOrdersQuery({ status: 'processing', page: 2 })).toBe('/admin/orders?status=processing&page=2');
  });

  it('requests list and detail resources', async () => {
    const page = { data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 } };
    const order = { id: '42', reference: 'ORD-42' };
    mocks.fetchJson.mockResolvedValueOnce(page).mockResolvedValueOnce({ data: order });

    await expect(fetchOrders({ status: 'processing', page: 2 })).resolves.toEqual(page);
    await expect(fetchOrder('42')).resolves.toEqual(order);
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/orders?status=processing&page=2');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/orders/42');
  });

  it('posts an optional refund amount and return action', async () => {
    mocks.fetchJson.mockReset();
    mocks.fetchJson.mockResolvedValue({ data: { id: '42' } });

    await refundOrder('42', 12.5);
    await refundOrder('42');
    await returnOrder('42');

    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/orders/42/refund', { method: 'POST', body: { amount: 12.5 } });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/orders/42/refund', { method: 'POST', body: {} });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/orders/42/return', { method: 'POST' });
  });
});
