import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useCreateShippingMethod: vi.fn(), useUpdateShippingMethod: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  useCreateShippingMethod: () => mocks.useCreateShippingMethod(),
  useUpdateShippingMethod: () => mocks.useUpdateShippingMethod(),
}));

import { ShippingMethodModal } from './ShippingMethodModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const method = {
  id: 7,
  code: 'express',
  name: 'Express Delivery',
  eta: '1-2 business days',
  price: '19.99',
  free_over: '100.00',
  created_at: '2026-08-30T00:00:00Z',
  updated_at: '2026-08-30T00:00:00Z',
};

function renderModal(editing = false) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ShippingMethodModal, { open: true, method: editing ? method : null, onClose: vi.fn() })));
  return { host, root };
}

function setInput(host: HTMLElement, id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ShippingMethodModal', () => {
  it('disables the immutable edit code and warns that changes apply to live checkout', () => {
    mocks.useCreateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderModal(true);

    expect(host.querySelector<HTMLInputElement>('#shipping-code')?.disabled).toBe(true);
    expect(host.textContent).toContain('shipping.code_readonly');
    expect(host.textContent).toContain('shipping.live_checkout_warning');

    act(() => root.unmount());
    host.remove();
  });

  it('submits all create fields and update fields without code', async () => {
    const createMutate = vi.fn();
    const updateMutate = vi.fn();
    mocks.useCreateShippingMethod.mockReturnValue({ mutate: createMutate, isPending: false });
    mocks.useUpdateShippingMethod.mockReturnValue({ mutate: updateMutate, isPending: false });
    const created = renderModal();

    setInput(created.host, 'shipping-code', 'next-day');
    setInput(created.host, 'shipping-name', 'Next Day');
    setInput(created.host, 'shipping-eta', 'Tomorrow');
    setInput(created.host, 'shipping-price', '29.99');
    setInput(created.host, 'shipping-free-over', '150');
    await act(async () => created.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(createMutate).toHaveBeenCalledWith({ code: 'next-day', name: 'Next Day', eta: 'Tomorrow', price: 29.99, free_over: 150 }, expect.any(Object));
    act(() => created.root.unmount());
    created.host.remove();

    const edited = renderModal(true);
    setInput(edited.host, 'shipping-name', 'Priority Delivery');
    setInput(edited.host, 'shipping-eta', '');
    setInput(edited.host, 'shipping-price', '24.50');
    setInput(edited.host, 'shipping-free-over', '');
    await act(async () => edited.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(updateMutate).toHaveBeenCalledWith({
      id: 7,
      payload: { name: 'Priority Delivery', eta: null, price: 24.5, free_over: null },
    }, expect.any(Object));
    act(() => edited.root.unmount());
    edited.host.remove();
  });
});
