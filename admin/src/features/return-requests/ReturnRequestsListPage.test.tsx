import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useReturnRequests: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./api', () => ({ useReturnRequests: (...args: unknown[]) => mocks.useReturnRequests(...args) }));

import { ReturnRequestsListPage } from './ReturnRequestsListPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ReturnRequestsListPage)));
  return { host, root };
}

describe('ReturnRequestsListPage', () => {
  it('formats nullable return amounts and navigates through the accessible View action', () => {
    mocks.navigate.mockReset();
    mocks.useReturnRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [{ id: 'return-42', order_reference: 'PP-0042', reason: 'Damaged', status: 'requested', items: [], refund_amount: 12.5, restocking_fee: null, requested_at: null }],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('$12.50');
    expect(host.textContent).toContain('—');
    const view = Array.from(host.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'common.view');
    expect(view).toBeTruthy();
    act(() => view!.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/return-requests/return-42');

    act(() => root.unmount());
    host.remove();
  });
});
