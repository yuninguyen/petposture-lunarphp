import { describe, expect, it, vi } from 'vitest';

const fetchJson = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ fetchJson }));

import { fetchPaymentMethods, testPaymentMethod, updatePaymentMethod } from './api';

describe('payment methods API', () => {
  it('uses only the Laravel payment-method endpoints and preserves wrapped responses', async () => {
    const listResponse = { data: [] };
    const methodResponse = { data: { gateway: 'stripe' } };
    const testResponse = { data: { gateway: 'stripe', status: 'connected' } };
    fetchJson.mockResolvedValueOnce(listResponse).mockResolvedValueOnce(methodResponse).mockResolvedValueOnce(testResponse);

    const updatePayload = { mode: 'live', fields: { stripe_secret: 'candidate' }, clear_fields: ['stripe_key'] };
    const candidatePayload = { mode: 'live', fields: { stripe_secret: 'candidate' } };

    await expect(fetchPaymentMethods()).resolves.toBe(listResponse);
    await expect(updatePaymentMethod('stripe', updatePayload)).resolves.toBe(methodResponse);
    await expect(testPaymentMethod('stripe', candidatePayload)).resolves.toBe(testResponse);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/finance/payment-methods');
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/finance/payment-methods/stripe', { method: 'PUT', body: updatePayload });
    expect(fetchJson).toHaveBeenNthCalledWith(3, '/admin/finance/payment-methods/stripe/test', { method: 'POST', body: candidatePayload });
  });
});
