import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useReturnRequest: vi.fn(),
  useApproveReturnRequest: vi.fn(),
  useRejectReturnRequest: vi.fn(),
  useCompleteReturnRequest: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: 'return-42' }) }));
vi.mock('./api', () => ({
  useReturnRequest: (...args: unknown[]) => mocks.useReturnRequest(...args),
  useApproveReturnRequest: () => mocks.useApproveReturnRequest(),
  useRejectReturnRequest: () => mocks.useRejectReturnRequest(),
  useCompleteReturnRequest: () => mocks.useCompleteReturnRequest(),
}));

import { ReturnRequestDetailPage } from './ReturnRequestDetailPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ReturnRequestDetailPage)));
  return { host, root };
}

describe('ReturnRequestDetailPage', () => {
  it('formats nullable refund and restocking amounts as dollars', () => {
    mocks.useApproveReturnRequest.mockReturnValue({ isPending: false });
    mocks.useRejectReturnRequest.mockReturnValue({ isPending: false });
    mocks.useCompleteReturnRequest.mockReturnValue({ isPending: false });
    mocks.useReturnRequest.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { id: 'return-42', order_reference: 'PP-0042', reason: 'Damaged', status: 'requested', customer_note: null, admin_note: null, rma_address: null, refund_amount: 12.5, restocking_fee: null, fee_waived: false, requested_at: null, approved_at: null, rejected_at: null, completed_at: null, items: [] },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('$12.50');
    expect(host.textContent).toContain('—');

    act(() => root.unmount());
    host.remove();
  });
});
