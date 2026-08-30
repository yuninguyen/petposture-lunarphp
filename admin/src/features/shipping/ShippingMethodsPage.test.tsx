import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useShippingMethods: vi.fn(), useDeleteShippingMethod: vi.fn(), useCreateShippingMethod: vi.fn(), useUpdateShippingMethod: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => key === 'shipping.delete_warning'
      ? `Xóa “${values?.name}”? Việc xóa sẽ ảnh hưởng ngay đến trang thanh toán đang hoạt động.`
      : key,
  }),
}));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('./api', () => ({
  useShippingMethods: () => mocks.useShippingMethods(),
  useDeleteShippingMethod: () => mocks.useDeleteShippingMethod(),
  useCreateShippingMethod: () => mocks.useCreateShippingMethod(),
  useUpdateShippingMethod: () => mocks.useUpdateShippingMethod(),
}));

import { ShippingMethodsPage } from './ShippingMethodsPage';

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

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ShippingMethodsPage)));
  return { host, root };
}

describe('ShippingMethodsPage', () => {
  it('renders required columns, an explicit live-checkout warning, and an empty state', () => {
    mocks.useShippingMethods.mockReturnValue({ isLoading: false, isError: false, data: [] });
    mocks.useDeleteShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useCreateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    expect(host.textContent).toContain('shipping.code');
    expect(host.textContent).toContain('shipping.name');
    expect(host.textContent).toContain('shipping.eta');
    expect(host.textContent).toContain('shipping.price');
    expect(host.textContent).toContain('shipping.free_over');
    expect(host.textContent).toContain('shipping.live_checkout_warning');
    expect(host.textContent).toContain('shipping.empty');

    act(() => root.unmount());
    host.remove();
  });

  it('opens the edit modal from the row kebab menu', () => {
    mocks.useShippingMethods.mockReturnValue({ isLoading: false, isError: false, data: [method] });
    mocks.useDeleteShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useCreateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    const methodRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Express Delivery'))!;
    const actionsButton = Array.from(methodRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    act(() => actionsButton?.click());
    const editButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.edit')!;
    act(() => editButton.click());

    expect(host.textContent).toContain('shipping.edit_title');
    act(() => root.unmount());
    host.remove();
  });

  it('keeps the localized checkout-impact confirmation open and shows the backend 409 message', () => {
    mocks.useShippingMethods.mockReturnValue({ isLoading: false, isError: false, data: [method] });
    mocks.useDeleteShippingMethod.mockReturnValue({
      isPending: false,
      mutate: (_id: number, options: { onError: (error: Error & { status: number; data: { message: string } }) => void }) => {
        options.onError(Object.assign(new Error('Request failed'), {
          status: 409,
          data: { message: 'This shipping method cannot be deleted because it is used by a nonterminal order.' },
        }));
      },
    });
    mocks.useCreateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useUpdateShippingMethod.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    const methodRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Express Delivery'))!;
    const actionsButton = Array.from(methodRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    expect(actionsButton).toBeTruthy();
    act(() => actionsButton?.click());

    const deleteButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete')!;
    act(() => deleteButton.click());
    expect(host.textContent).toContain('Xóa “Express Delivery”? Việc xóa sẽ ảnh hưởng ngay đến trang thanh toán đang hoạt động.');

    const confirmButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete')!;
    act(() => confirmButton.click());

    expect(toast.error).toHaveBeenCalledWith('This shipping method cannot be deleted because it is used by a nonterminal order.');
    expect(host.textContent).toContain('shipping.delete_title');
    expect(host.textContent).toContain('Xóa “Express Delivery”? Việc xóa sẽ ảnh hưởng ngay đến trang thanh toán đang hoạt động.');

    act(() => root.unmount());
    host.remove();
  });
});
