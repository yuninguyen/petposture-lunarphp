import { describe, expect, it, vi } from 'vitest';

const fetchJson = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ fetchJson }));

import {
  buildShippingMethodUpdatePayload,
  createShippingMethod,
  deleteShippingMethod,
  normalizeShippingMethodResponse,
  normalizeShippingMethodsResponse,
  updateShippingMethod,
} from './api';

const method = {
  id: 7,
  code: 'express',
  name: 'Express Delivery',
  eta: '1-2 business days',
  price: '19.99',
  free_over: '100.00',
  created_at: '2026-08-30T00:00:00Z',
  updated_at: '2026-08-30T00:00:00Z',
};

describe('shipping method API', () => {
  it('normalizes wrapped shipping-method list and item responses', () => {
    expect(normalizeShippingMethodsResponse({ data: [method] })).toEqual([method]);
    expect(normalizeShippingMethodResponse({ data: method })).toEqual(method);
  });

  it('sends create, update, and delete requests to the shipping endpoint with the required methods and payloads', async () => {
    fetchJson.mockResolvedValueOnce({ data: method }).mockResolvedValueOnce({ data: method }).mockResolvedValueOnce(null);
    const createPayload = { code: 'express', name: 'Express Delivery', eta: '1-2 business days', price: 19.99, free_over: 100 };
    const updatePayload = { name: 'Priority Delivery', eta: null, price: 24.5, free_over: null };

    await createShippingMethod(createPayload);
    await updateShippingMethod(method.id, updatePayload);
    await deleteShippingMethod(method.id);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/shipping-methods', { method: 'POST', body: createPayload });
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/shipping-methods/7', { method: 'PUT', body: updatePayload });
    expect(fetchJson).toHaveBeenNthCalledWith(3, '/admin/shipping-methods/7', { method: 'DELETE' });
  });

  it('omits the immutable code from update payloads', () => {
    expect(buildShippingMethodUpdatePayload({
      code: 'express',
      name: 'Priority Delivery',
      eta: '',
      price: '24.50',
      free_over: '',
    })).toEqual({
      name: 'Priority Delivery',
      eta: null,
      price: 24.5,
      free_over: null,
    });
  });
});
