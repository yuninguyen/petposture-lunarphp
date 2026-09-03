import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import viLocale from '@/locales/vi.json';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), mutateAsync: vi.fn(), fetchVariants: vi.fn(), useOrderProductPicker: vi.fn(), toastError: vi.fn(), isPending: false }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }));
vi.mock('./api', () => ({ useCreateOrder: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }), fetchOrderProductVariants: mocks.fetchVariants, useOrderProductPicker: mocks.useOrderProductPicker }));

import { OrderFormPage } from './OrderFormPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, null, createElement(OrderFormPage))));
  return { host, root };
}

function setValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); });
}

function fillRequiredFields(host: HTMLElement) {
  setValue(host.querySelector<HTMLInputElement>('[name="email"]')!, 'buyer@example.test');
  setValue(host.querySelector<HTMLInputElement>('[name="shipping.first_name"]')!, 'Ada');
  setValue(host.querySelector<HTMLInputElement>('[name="shipping.line_one"]')!, '1 Main Street');
  setValue(host.querySelector<HTMLInputElement>('[name="shipping.city"]')!, 'Austin');
}

describe('OrderFormPage', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.mutateAsync.mockReset();
    mocks.fetchVariants.mockReset();
    mocks.toastError.mockReset();
    mocks.isPending = false;
    vi.useRealTimers();
    mocks.useOrderProductPicker.mockReturnValue({ data: [{ id: 1, name: 'Harness' }, { id: 2, name: 'Leash' }], isLoading: false });
  });

  it('renders required sections with approved defaults and hides billing fields', () => {
    const { host, root } = renderPage();
    for (const key of ['orders.customer', 'orders.items', 'orders.shipping_address', 'orders.billing_address', 'orders.settings', 'orders.notes']) expect(host.textContent).toContain(key);
    expect(host.querySelector<HTMLSelectElement>('[name="shipping.country"]')!.value).toBe('US');
    expect(host.querySelector<HTMLSelectElement>('[name="payment_method"]')!.value).toBe('cod');
    expect(host.querySelector<HTMLSelectElement>('[name="shipping_method"]')!.value).toBe('standard');
    expect(host.querySelector('[name="billing.first_name"]')).toBeNull();
    act(() => root.unmount()); host.remove();
  });

  it('waits 300ms before searching products', () => {
    vi.useFakeTimers();
    const { host, root } = renderPage();
    setValue(host.querySelector<HTMLInputElement>('input[placeholder="orders.search_products"]')!, 'leash');
    expect(mocks.useOrderProductPicker).not.toHaveBeenCalledWith('leash');
    act(() => { vi.advanceTimersByTime(299); });
    expect(mocks.useOrderProductPicker).not.toHaveBeenCalledWith('leash');
    act(() => { vi.advanceTimersByTime(1); });
    expect(mocks.useOrderProductPicker).toHaveBeenCalledWith('leash');
    act(() => root.unmount()); host.remove();
  });

  it('starts selected quantities at one and blocks zero or negative quantities', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    const quantity = host.querySelector<HTMLInputElement>('[name="quantity.10"]')!;
    expect(quantity.value).toBe('1');
    fillRequiredFields(host);
    setValue(quantity, '0');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    setValue(quantity, '-1');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    act(() => root.unmount()); host.remove();
  });

  it('shows billing fields and submits their distinct payload when billing differs', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    mocks.mutateAsync.mockResolvedValue({ id: 'order-billing' });
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    fillRequiredFields(host);
    act(() => host.querySelector<HTMLInputElement>('[name="billing_same_as_shipping"]')!.click());
    expect(host.querySelector('[name="billing.first_name"]')).not.toBeNull();
    setValue(host.querySelector<HTMLInputElement>('[name="billing.first_name"]')!, 'Grace');
    setValue(host.querySelector<HTMLInputElement>('[name="billing.line_one"]')!, '2 Billing Street');
    setValue(host.querySelector<HTMLInputElement>('[name="billing.city"]')!, 'Dallas');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ billing_same_as_shipping: false, billing: { first_name: 'Grace', line_one: '2 Billing Street', city: 'Dallas', country: 'US' } }));
    act(() => root.unmount()); host.remove();
  });

  it('uses the order translation key while saving', async () => {
    mocks.isPending = true;
    const { host, root } = renderPage();
    expect(host.textContent).toContain('orders.saving');
    act(() => root.unmount()); host.remove();
  });

  it('uses the order error translation for unexpected submission failures', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    mocks.mutateAsync.mockRejectedValue(new Error());
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    fillRequiredFields(host);
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.toastError).toHaveBeenCalledWith('orders.error_occurred');
    act(() => root.unmount()); host.remove();
  });

  it('retains selected variant rows while selecting variants from another product', async () => {
    mocks.fetchVariants.mockResolvedValueOnce([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]).mockResolvedValueOnce([{ id: 20, sku: 'LEASH-M', label: 'Leash / Medium', price: 10, formatted_price: '$10.00', stock: 5, purchasable: 'always' }]);
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Leash'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(host.textContent).toContain('Harness / Small');
    expect(host.textContent).toContain('Leash / Medium');
    expect(host.querySelectorAll('[name^="quantity."]').length).toBe(2);
    act(() => root.unmount()); host.remove();
  });

  it('submits selected quantities, retains a zero fee, and omits blank optional values', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    mocks.mutateAsync.mockResolvedValue({ id: 'order-42' });
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    setValue(host.querySelector<HTMLInputElement>('[name="quantity.10"]')!, '2');
    fillRequiredFields(host);
    setValue(host.querySelector<HTMLInputElement>('[name="shipping_fee_override"]')!, '0');
    act(() => host.querySelector<HTMLInputElement>('[name="billing_same_as_shipping"]')!.click());
    setValue(host.querySelector<HTMLInputElement>('[name="billing.first_name"]')!, 'Grace');
    setValue(host.querySelector<HTMLInputElement>('[name="billing.line_one"]')!, '2 Main Street');
    setValue(host.querySelector<HTMLInputElement>('[name="billing.city"]')!, 'Austin');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ items: [{ variant_id: 10, quantity: 2 }], email: 'buyer@example.test', billing_same_as_shipping: false, shipping_fee_override: 0 }));
    expect(mocks.mutateAsync.mock.calls[0][0]).not.toHaveProperty('coupon_code');
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/order-42');
    act(() => root.unmount()); host.remove();
  });

  it('renders server 422 field messages in an alert', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    mocks.mutateAsync.mockRejectedValue(Object.assign(new Error('Invalid order'), { status: 422, data: { errors: { email: ['Email is invalid.'] } } }));
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    fillRequiredFields(host);
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Email is invalid.');
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    act(() => root.unmount()); host.remove();
  });

  it('shows a local alert instead of submitting when required fields are missing', async () => {
    const { host, root } = renderPage();
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('orders.validation_required');
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    act(() => root.unmount()); host.remove();
  });

  it('omits the fee override when the fee field is blank', async () => {
    mocks.fetchVariants.mockResolvedValue([{ id: 10, sku: 'HARNESS-S', label: 'Harness / Small', price: 20, formatted_price: '$20.00', stock: 5, purchasable: 'always' }]);
    mocks.mutateAsync.mockResolvedValue({ id: 'order-43' });
    const { host, root } = renderPage();
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Harness'))!.click());
    await act(async () => { await Promise.resolve(); });
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    fillRequiredFields(host);
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.mutateAsync.mock.calls[0][0]).not.toHaveProperty('shipping_fee_override');
    act(() => root.unmount()); host.remove();
  });

  it('contains all create-order locale keys in English and Vietnamese', () => {
    for (const key of ['orders.create_title', 'orders.customer', 'orders.settings', 'orders.select_product', 'orders.search_products', 'orders.shipping_fee_help', 'orders.create', 'orders.saving', 'orders.error_occurred', 'orders.server_validation_error']) {
      expect(en).toHaveProperty(key);
      expect(viLocale).toHaveProperty(key);
    }
  });
});
