import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useOrders: vi.fn() }));
const paymentLabels: Record<string, string> = {
  'orders.payment_card': 'Card',
  'orders.payment_credit_card': 'Credit Card',
  'orders.payment_debit_card': 'Debit Card',
  'orders.payment_prepaid_card': 'Prepaid Card',
  'orders.payment_paypal': 'PayPal',
  'orders.payment_cod': 'Cash on delivery',
};
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => paymentLabels[key] ?? key }) }));
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

  it('renders Customer cell with Jane Doe primary and buyer@example.com secondary under existing Customer heading', () => {
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [{
          id: 'order-1',
          reference: 'PP-0001',
          customer_email: 'buyer@example.com',
          shipping_address: { first_name: 'Jane', last_name: 'Doe' },
          total: { formatted: '$12.99', decimal: 12.99, currency: 'USD' },
          payment_method: 'card',
          status: 'processing',
          payment_status: 'paid',
          fulfillment_status: 'unfulfilled',
          created_at: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('orders.column_customer');
    expect(host.textContent).toContain('Jane Doe');
    expect(host.textContent).toContain('buyer@example.com');

    // Verify name is primary (bold/medium) and email is secondary
    const primaryName = Array.from(host.querySelectorAll('span')).find((el) => el.textContent === 'Jane Doe');
    expect(primaryName).toBeTruthy();
    expect(primaryName?.className).toContain('font-medium');

    const secondaryEmail = Array.from(host.querySelectorAll('span')).find((el) => el.textContent === 'buyer@example.com');
    expect(secondaryEmail).toBeTruthy();
    expect(secondaryEmail?.className).toContain('text-slate-500');

    act(() => root.unmount());
    host.remove();
  });

  it('renders email alone when no customer name exists, without an empty primary row', () => {
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [{
          id: 'order-2',
          reference: 'PP-0002',
          customer_email: 'noname@example.com',
          shipping_address: null,
          billing_address: null,
          total: { formatted: '$50.00', decimal: 50.0, currency: 'USD' },
          payment_method: 'cod',
          status: 'processing',
          payment_status: 'pending',
          fulfillment_status: 'unfulfilled',
          created_at: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('noname@example.com');
    // Ensure no empty primary div/span was rendered
    const customerCell = host.querySelectorAll('td')[1];
    expect(customerCell.querySelector('.flex.flex-col')).toBeNull();

    act(() => root.unmount());
    host.remove();
  });

  it('displays debit Mastercard/4444 and USD $12.99; generic Credit Card must not appear', () => {
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [{
          id: 'order-3',
          reference: 'PP-0003',
          customer_email: 'debit@example.com',
          shipping_address: { first_name: 'Alex', last_name: 'Cardholder' },
          total: { formatted: '$12.99', decimal: 12.99, currency: 'USD' },
          payment_method: 'card',
          card_funding: 'debit',
          card_brand: 'mastercard',
          card_last4: '4444',
          status: 'processing',
          payment_status: 'paid',
          fulfillment_status: 'unfulfilled',
          created_at: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      },
    });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('Debit Card');
    expect(host.textContent).toContain('Mastercard •••• 4444');
    expect(host.textContent).toContain('USD $12.99');
    expect(host.textContent).not.toContain('Credit Card');

    act(() => root.unmount());
    host.remove();
  });

  it('keeps 9 table columns and StateRow colSpan consistent', () => {
    mocks.useOrders.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } },
    });
    const { host, root } = renderPage();

    const ths = host.querySelectorAll('thead th');
    expect(ths.length).toBe(9);

    const emptyCell = host.querySelector('tbody td');
    expect(emptyCell?.getAttribute('colspan')).toBe('9');

    act(() => root.unmount());
    host.remove();
  });
});
