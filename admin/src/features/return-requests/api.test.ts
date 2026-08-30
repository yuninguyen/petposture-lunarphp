import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import {
  approveReturnRequest,
  buildReturnRequestsQuery,
  completeReturnRequest,
  fetchReturnRequest,
  fetchReturnRequests,
  rejectReturnRequest,
} from './api';

describe('return requests api', () => {
  it('builds the list query with only non-empty status and page values', () => {
    expect(buildReturnRequestsQuery({ status: '', page: 0 })).toBe('/admin/return-requests');
    expect(buildReturnRequestsQuery({ status: 'requested', page: 2 })).toBe('/admin/return-requests?status=requested&page=2');
  });

  it('requests list and detail resources', async () => {
    const page = { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } };
    const request = { id: '42', order_reference: 'ORD-42' };
    mocks.fetchJson.mockResolvedValueOnce(page).mockResolvedValueOnce({ data: request });

    await expect(fetchReturnRequests({ status: 'requested', page: 2 })).resolves.toEqual(page);
    await expect(fetchReturnRequest('42')).resolves.toEqual(request);
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/return-requests?status=requested&page=2');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/return-requests/42');
  });

  it('posts approve, reject, and complete action payloads', async () => {
    mocks.fetchJson.mockReset();
    mocks.fetchJson.mockResolvedValue({ data: { id: '42' } });

    await approveReturnRequest('42', { rma_address: '123 Return Lane', fee_waived: true, refund_amount: 12.5, admin_note: 'Approved' });
    await rejectReturnRequest('42', { admin_note: 'Outside policy' });
    await completeReturnRequest('42');

    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/return-requests/42/approve', { method: 'POST', body: { rma_address: '123 Return Lane', fee_waived: true, refund_amount: 12.5, admin_note: 'Approved' } });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/return-requests/42/reject', { method: 'POST', body: { admin_note: 'Outside policy' } });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/return-requests/42/complete', { method: 'POST' });
  });
});
