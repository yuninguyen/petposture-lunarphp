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

function orderPage(page: number) {
  return {
    isLoading: false,
    isError: false,
    data: {
      data: [{ id: '42', reference: 'ORD-42', customer_email: 'customer@example.com', total: { formatted: '$12.50 USD', decimal: 12.5, currency: 'USD' }, status: 'processing', payment_status: 'paid', fulfillment_status: 'unfulfilled', created_at: '2026-08-30 12:00:00' }],
      meta: { current_page: page, last_page: 3, per_page: 15, total: 31 },
    },
  };
}

describe('OrdersListPage', () => {
  it('offers only backend-supported status filters', () => {
    mocks.useOrders.mockReturnValue(orderPage(1));
    const { host, root } = renderPage();

    expect(Array.from((host.querySelector('select') as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      '', 'awaiting-payment', 'payment-offline', 'payment-received', 'processing', 'shipped', 'delivered', 'cancelled',
    ]);

    act(() => root.unmount());
    host.remove();
  });

  it('requests the selected status from page one and paginates the current filter', () => {
    mocks.navigate.mockReset();
    mocks.useOrders.mockImplementation(({ page }: { page: number }) => orderPage(page));
    const { host, root } = renderPage();

    const next = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.next')!;
    act(() => next.click());
    expect(mocks.useOrders).toHaveBeenLastCalledWith({ status: '', page: 2 });

    const filter = host.querySelector('select') as HTMLSelectElement;
    act(() => {
      filter.value = 'payment-received';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mocks.useOrders).toHaveBeenLastCalledWith({ status: 'payment-received', page: 1 });

    const reference = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'ORD-42')!;
    act(() => reference.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/42');

    act(() => root.unmount());
    host.remove();
  });
});
