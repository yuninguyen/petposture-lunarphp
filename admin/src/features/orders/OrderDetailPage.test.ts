import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), refund: vi.fn(), returnOrder: vi.fn(), action: vi.fn(), shipment: vi.fn(), refetch: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(), order: { id: '42', reference: 'ORD-42', customer_email: 'customer@example.com', status: 'processing', status_label: 'Processing', payment_status: 'paid', payment_status_label: 'Paid', fulfillment_status: 'unfulfilled', fulfillment_status_label: 'Unfulfilled', refund_status: 'partially_refunded', refund_amount: 450, coupon_code: 'SAVE10', total: { formatted: '$12.50 USD', decimal: 12.5, currency: 'USD' }, sub_total: 15, discount_total: 5, shipping_total: 0, shipping_label: 'Express', tax_total: 2.5, lines: [{ id: 1, type: 'product', description: 'Orthopedic Bed', quantity: 2, unit_price: 7.5, sub_total: 15, discount_total: 0, tax_total: 0, total: 15, image: null }], attribution_origin: 'newsletter', attribution_device_type: 'mobile', attribution_session_page_views: 4, fraud_risk_level: null as string | null, fraud_risk_score: null as number | null, fraud_seller_message: null as string | null, shipping_address: {}, billing_address: {}, order_events: [{ type: 'shipped', title: 'Shipped second', detail: null, created_at: '2026-08-30 12:00:00' }, { type: 'created', title: 'Created first', detail: null, created_at: '2026-08-29 12:00:00' }], available_actions: [{ action: 'cancelOrder', label: 'Cancel order' }, { action: 'capturePayment', label: 'Capture payment' }, { action: 'markShipped', label: 'Mark shipped' }], remaining_shippable_quantities: { '1': 2 }, refund_reason_options: [{ value: 'customer_request', label: 'Customer request' }, { value: 'duplicate', label: 'Duplicate order' }] } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: '42' }) }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('./api', () => ({
  useOrder: () => ({ isLoading: false, isError: false, data: mocks.order, refetch: mocks.refetch }),
  useRefundOrder: () => ({ mutateAsync: mocks.refund, isPending: false }),
  useReturnOrder: () => ({ mutateAsync: mocks.returnOrder, isPending: false }),
  useOrderAction: () => ({ mutateAsync: mocks.action, isPending: false }),
  useCreateShipment: () => ({ mutateAsync: mocks.shipment, isPending: false }),
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

function changeValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

beforeEach(() => {
  mocks.refund.mockReset();
  mocks.returnOrder.mockReset();
  mocks.action.mockReset();
  mocks.shipment.mockReset();
  mocks.refetch.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.refund.mockResolvedValue({ id: '42' });
  mocks.returnOrder.mockResolvedValue({ id: '42' });
  mocks.action.mockResolvedValue({ id: '42' });
  mocks.shipment.mockResolvedValue({ id: '42' });
  mocks.refetch.mockResolvedValue({});
  mocks.order.available_actions = [{ action: 'cancelOrder', label: 'Cancel order' }, { action: 'capturePayment', label: 'Capture payment' }, { action: 'markShipped', label: 'Mark shipped' }];
  mocks.order.remaining_shippable_quantities = { '1': 2 };
  mocks.order.refund_reason_options = [{ value: 'customer_request', label: 'Customer request' }, { value: 'duplicate', label: 'Duplicate order' }];
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
    act(() => changeValue(host.querySelector('select[name="refund-reason"]') as HTMLSelectElement, 'customer_request'));

    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.refund).toHaveBeenCalledWith({ id: '42', amount: 4.25, reason: 'customer_request' });
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
    act(() => changeValue(host.querySelector('select[name="refund-reason"]') as HTMLSelectElement, 'customer_request'));
    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.refund).toHaveBeenCalledWith({ id: '42', amount: 4.25, reason: 'customer_request' });
    expect(mocks.toastError).toHaveBeenCalledWith('Refund rejected');
    expect((host.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('4.25');

    act(() => root.unmount());
    host.remove();
  });

  it('renders title-cased refund money, item rows, totals, and attribution', () => {
    const { host, root } = renderPage();

    expect(host.textContent).toContain('Partially Refunded');
    expect(host.textContent).toContain('$4.50');
    expect(host.querySelector('table')?.textContent).toContain('orders.product');
    expect(host.querySelector('table')?.textContent).toContain('orders.qty');
    expect(host.querySelector('table')?.textContent).toContain('orders.unit_price');
    expect(host.querySelector('table')?.textContent).toContain('orders.subtotal');
    expect(host.querySelector('table')?.textContent).toContain('Orthopedic Bed');
    expect(host.querySelector('table')?.textContent).toContain('$7.50');
    expect(host.querySelector('table')?.textContent).toContain('$15.00');
    expect(host.textContent).toContain('orders.items_subtotal');
    expect(host.textContent).toContain('orders.discount');
    expect(host.textContent).toContain('SAVE10');
    expect(host.textContent).toContain('orders.shipping');
    expect(host.textContent).toContain('Express');
    expect(host.textContent).toContain('$0.00');
    expect(host.textContent).toContain('orders.tax');
    expect(host.textContent).toContain('$2.50');
    expect(host.textContent).toContain('orders.order_total');
    expect(host.textContent).toContain('orders.attribution');
    expect(host.textContent).toContain('newsletter');
    expect(host.textContent).toContain('mobile');
    expect(host.textContent).toContain('4');

    act(() => root.unmount());
    host.remove();
  });

  it('hides Fraud & Risk without fraud data and shows a red badge when present', () => {
    const { host, root } = renderPage();

    expect(host.textContent).not.toContain('orders.fraud_risk');

    act(() => root.unmount());
    host.remove();

    mocks.order.fraud_risk_level = 'highest';
    mocks.order.fraud_risk_score = 91;
    mocks.order.fraud_seller_message = 'Review before fulfillment';
    const visible = renderPage();

    expect(visible.host.textContent).toContain('orders.fraud_risk');
    expect(visible.host.textContent).toContain('Highest');
    expect(visible.host.textContent).toContain('91');
    expect(visible.host.textContent).toContain('Review before fulfillment');
    expect(visible.host.querySelector('.bg-red-50')).not.toBeNull();

    act(() => visible.root.unmount());
    visible.host.remove();
    mocks.order.fraud_risk_level = null;
    mocks.order.fraud_risk_score = null;
    mocks.order.fraud_seller_message = null;
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

  it('renders available generic actions but excludes markShipped and styles cancellation as danger', () => {
    const { host, root } = renderPage();

    expect(button(host, 'Cancel order').className).toContain('bg-red-600');
    expect(button(host, 'Capture payment')).toBeTruthy();
    expect(Array.from(host.querySelectorAll('button')).map((candidate) => candidate.textContent)).not.toContain('Mark shipped');

    act(() => root.unmount());
    host.remove();
  });

  it('opens a shipment form with manual carrier and exact remaining quantities, then submits selected positive items', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.mark_shipped').click());

    const carrier = host.querySelector('select[name="carrier"]') as HTMLSelectElement;
    expect(carrier.value).toBe('manual');
    expect(Array.from(carrier.options).map((option) => option.text)).toEqual(['orders.carrier_ups', 'orders.carrier_usps', 'orders.carrier_fedex', 'orders.carrier_dhl', 'orders.carrier_manual']);
    expect((host.querySelector('input[name="shipment-quantity-1"]') as HTMLInputElement).value).toBe('2');
    expect(host.textContent).toContain('Orthopedic Bed');
    act(() => changeValue(host.querySelector('input[name="tracking-number"]') as HTMLInputElement, 'TRACK-123'));
    act(() => changeValue(carrier, 'ups'));
    act(() => changeValue(host.querySelector('input[name="shipment-quantity-1"]') as HTMLInputElement, '1'));

    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.action).toHaveBeenCalledWith({ id: '42', action: 'markShipped' });
    expect(mocks.shipment).toHaveBeenCalledWith({ id: '42', payload: { tracking_number: 'TRACK-123', shipment_carrier: 'ups', items: [{ order_line_id: 1, quantity: 1 }] } });

    act(() => root.unmount());
    host.remove();
  });

  it('does not create a shipment when markShipped fails, and refetches after a shipment failure', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.mark_shipped').click());
    act(() => changeValue(host.querySelector('input[name="tracking-number"]') as HTMLInputElement, 'TRACK-123'));
    mocks.action.mockRejectedValueOnce(new Error('Action rejected'));

    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.shipment).not.toHaveBeenCalled();
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('Action rejected');

    mocks.action.mockResolvedValueOnce({ id: '42' });
    mocks.shipment.mockRejectedValueOnce(new Error('Shipment rejected'));
    await act(async () => button(host, 'common.confirm').click());

    expect(mocks.action).toHaveBeenLastCalledWith({ id: '42', action: 'markShipped' });
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith('Shipment rejected');

    act(() => root.unmount());
    host.remove();
  });

  it('requires an API-provided refund reason and includes it in the refund payload', async () => {
    const { host, root } = renderPage();
    act(() => button(host, 'orders.refund').click());

    const reason = host.querySelector('select[name="refund-reason"]') as HTMLSelectElement;
    expect(Array.from(reason.options).map((option) => option.text)).toEqual(['orders.refund_reason_placeholder', 'Customer request', 'Duplicate order']);
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.refund).not.toHaveBeenCalled();

    act(() => changeValue(reason, 'duplicate'));
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.refund).toHaveBeenCalledWith({ id: '42', amount: undefined, reason: 'duplicate' });

    act(() => root.unmount());
    host.remove();
  });

  it('hides shipment controls when every remaining shippable quantity is zero', () => {
    mocks.order.remaining_shippable_quantities = { '1': 0 };
    const { host, root } = renderPage();

    expect(Array.from(host.querySelectorAll('button')).map((candidate) => candidate.textContent)).not.toContain('orders.mark_shipped');

    act(() => root.unmount());
    host.remove();
  });
});
