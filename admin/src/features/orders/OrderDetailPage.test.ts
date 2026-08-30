import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), refund: vi.fn(), returnOrder: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: '42' }) }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('./api', () => ({
  useOrder: () => ({ isLoading: false, isError: false, data: { id: '42', reference: 'ORD-42', customer_email: 'customer@example.com', status: 'processing', status_label: 'Processing', payment_status: 'paid', payment_status_label: 'Paid', fulfillment_status: 'unfulfilled', fulfillment_status_label: 'Unfulfilled', refund_status: null, refund_amount: null, coupon_code: 'SAVE10', total: { formatted: '$12.50 USD', decimal: 12.5, currency: 'USD' }, lines: [], shipping_address: {}, billing_address: {}, order_events: [{ type: 'shipped', title: 'Shipped second', detail: null, created_at: '2026-08-30 12:00:00' }, { type: 'created', title: 'Created first', detail: null, created_at: '2026-08-29 12:00:00' }] } }),
  useRefundOrder: () => ({ mutateAsync: mocks.refund, isPending: false }),
  useReturnOrder: () => ({ mutateAsync: mocks.returnOrder, isPending: false }),
}));

import { OrderDetailPage } from './OrderDetailPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(canRefund = true) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(OrderDetailPage, { canRefund })));
  return { host, root };
}

function button(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll('button')).find((candidate) => candidate.textContent === text)!;
}

function changeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  mocks.refund.mockReset();
  mocks.returnOrder.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.refund.mockResolvedValue({ id: '42' });
  mocks.returnOrder.mockResolvedValue({ id: '42' });
});

describe('OrderDetailPage', () => {
  it('hides the refund action when canRefund is false while retaining return', () => {
    const { host, root } = renderPage(false);

    expect(Array.from(host.querySelectorAll('button')).map((candidate) => candidate.textContent)).not.toContain('orders.refund');
    expect(Array.from(host.querySelectorAll('button')).map((candidate) => candidate.textContent)).toContain('orders.mark_returned');

    act(() => root.unmount());
    host.remove();
  });

  it('renders order events in chronological order', () => {
    const { host, root } = renderPage();

    expect(host.textContent!.indexOf('Created first')).toBeLessThan(host.textContent!.indexOf('Shipped second'));

    act(() => root.unmount());
    host.remove();
  });

  it('submits a positive refund amount and closes the successful confirmation', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.refund').click());
    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    act(() => changeValue(input, '4.25'));

    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.refund).toHaveBeenCalledWith({ id: '42', amount: 4.25 });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('orders.refund_success');
    expect(host.querySelector('input[type="number"]')).toBeNull();

    act(() => root.unmount());
    host.remove();
  });

  it('keeps the refund modal and entered amount open for invalid and failed refunds', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.refund').click());
    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    act(() => changeValue(input, '0'));
    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('orders.refund_amount_invalid');
    expect((host.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('0');

    mocks.refund.mockRejectedValueOnce(new Error('Refund rejected'));
    act(() => changeValue(host.querySelector('input[type="number"]') as HTMLInputElement, '4.25'));
    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.refund).toHaveBeenCalledWith({ id: '42', amount: 4.25 });
    expect(mocks.toastError).toHaveBeenCalledWith('Refund rejected');
    expect((host.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('4.25');

    act(() => root.unmount());
    host.remove();
  });

  it('shows return confirmation and submits the return action', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.mark_returned').click());

    expect(host.textContent).toContain('orders.return_confirm');
    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.returnOrder).toHaveBeenCalledWith({ id: '42' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('orders.return_success');
    expect(host.textContent).not.toContain('orders.return_confirm');

    act(() => root.unmount());
    host.remove();
  });

  it('keeps return confirmation open and shows an error when marking returned fails', async () => {
    const { host, root } = renderPage();
    mocks.returnOrder.mockRejectedValueOnce(new Error('Return rejected'));
    act(() => button(host, 'orders.mark_returned').click());

    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.returnOrder).toHaveBeenCalledWith({ id: '42' });
    expect(mocks.toastError).toHaveBeenCalledWith('Return rejected');
    expect(host.textContent).toContain('orders.return_confirm');

    act(() => root.unmount());
    host.remove();
  });
});
