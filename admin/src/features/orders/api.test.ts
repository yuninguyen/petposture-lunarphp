import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import { buildOrdersQuery, createShipment, fetchOrder, fetchOrders, refundOrder, returnOrder } from './api';

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

  it('posts the required refund reason in an object payload and return action', async () => {
    mocks.fetchJson.mockReset();
    mocks.fetchJson.mockResolvedValue({ data: { id: '42' } });

    await refundOrder('42', { amount: 12.5, reason: 'customer_request' });
    await refundOrder('42', { reason: 'duplicate' });
    await returnOrder('42');

    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/orders/42/refund', { method: 'POST', body: { amount: 12.5, reason: 'customer_request' } });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/orders/42/refund', { method: 'POST', body: { reason: 'duplicate' } });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/orders/42/return', { method: 'POST' });
  });

  it('posts an exact shipment_carrier key for UPS shipments', async () => {
    mocks.fetchJson.mockReset();
    mocks.fetchJson.mockResolvedValue({ data: { id: '42' } });

    await createShipment('42', { tracking_number: '1Z-UPS', shipment_carrier: 'ups', items: [{ order_line_id: 1, quantity: 1 }] });

    expect(mocks.fetchJson).toHaveBeenCalledWith('/orders/42/shipments', { method: 'POST', body: { tracking_number: '1Z-UPS', shipment_carrier: 'ups', items: [{ order_line_id: 1, quantity: 1 }] } });
  });

  it('rejects bare numeric refund payloads at the API boundary', () => {
    // @ts-expect-error refundOrder accepts only the object refund payload.
    const numericRefund = () => refundOrder('42', 12.5);
    expect(numericRefund).toBeTypeOf('function');
  });
});
