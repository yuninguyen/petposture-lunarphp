import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useOrders: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./api', () => ({ useOrders: (...args: unknown[]) => mocks.useOrders(...args) }));

import { OrdersListPage } from './OrdersListPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(OrdersListPage)));
  return { host, root };
}

describe('OrdersListPage', () => {
  it('navigates to the order detail when its accessible View action is clicked', () => {
    mocks.navigate.mockReset();
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [{ id: 'order-42', reference: 'PP-0042', customer_email: 'buyer@example.com', total: { formatted: '$12.99', decimal: 12.99, currency: 'USD' }, status: 'processing', payment_status: 'paid', fulfillment_status: 'unfulfilled', created_at: null }],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('common.actions');
    const view = Array.from(host.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'common.view');
    expect(view).toBeTruthy();
    act(() => view!.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/order-42');

    act(() => root.unmount());
    host.remove();
  });

  it('navigates to the create-order form from the translated header button', () => {
    mocks.navigate.mockReset();
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } },
    });
    const { host, root } = renderPage();

    const create = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'orders.create');
    expect(create).toBeTruthy();
    act(() => create!.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/new');

    act(() => root.unmount());
    host.remove();
  });
});
