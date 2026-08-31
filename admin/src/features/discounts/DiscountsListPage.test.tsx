import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useDiscounts: vi.fn(), useDeleteDiscount: vi.fn(), navigate: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  useDiscounts: (filters: unknown) => mocks.useDiscounts(filters),
  useDeleteDiscount: () => mocks.useDeleteDiscount(),
}));

import { DiscountsListPage } from './DiscountsListPage';
import type { Discount } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const discount: Discount = {
  id: 1, name: 'Summer sale', handle: 'summer-sale', coupon: 'SAVE10',
  type: 'Lunar\\DiscountTypes\\AmountOff' as const, type_label: 'Amount off', supported: true, status: 'active' as const,
  starts_at: '2026-08-31T12:00:00.000Z', ends_at: null, uses: 0, max_uses: null,
  max_uses_per_user: null, priority: null, stop: false, data: { min_prices: { USD: null } },
  created_at: '2026-08-31T12:00:00.000Z', updated_at: '2026-08-31T12:00:00.000Z',
};

function pageWith(data = [discount], currentPage = 1, lastPage = 2) {
  return { isLoading: false, isError: false, data: { data, meta: { current_page: currentPage, last_page: lastPage, per_page: 15, total: data.length } } };
}

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, null, createElement(DiscountsListPage))));
  return { host, root };
}

describe('DiscountsListPage', () => {
  it('renders all status badge mappings, safe type labels, columns, and row actions', () => {
    mocks.useDiscounts.mockReturnValue(pageWith([
      discount,
      { ...discount, id: 2, status: 'expired' },
      { ...discount, id: 3, status: 'pending' },
      { ...discount, id: 4, status: 'scheduled', type_label: '' },
    ]));
    mocks.useDeleteDiscount.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    for (const key of ['discounts.name', 'discounts.type', 'discounts.status', 'discounts.coupon', 'discounts.starts', 'discounts.ends', 'discounts.actions']) expect(host.textContent).toContain(key);
    expect(host.querySelector('.bg-emerald-100')).toBeTruthy();
    expect(host.querySelector('.bg-red-100')).toBeTruthy();
    expect(host.querySelector('.bg-slate-100')).toBeTruthy();
    expect(host.querySelector('.bg-blue-100')).toBeTruthy();
    expect(host.textContent).toContain('—');
    expect(host.querySelectorAll('button[aria-label="discounts.actions"]').length).toBe(4);

    act(() => (host.querySelector('button[aria-label="discounts.actions"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('discounts.edit');
    expect(host.textContent).toContain('discounts.delete');

    act(() => root.unmount());
    host.remove();
  });

  it('opens unsupported rows in the read-only detail route while retaining delete', () => {
    mocks.useDiscounts.mockReturnValue(pageWith([{ ...discount, supported: false, type_label: 'Unsupported' }]));
    mocks.useDeleteDiscount.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    act(() => (host.querySelector('button[aria-label="discounts.actions"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('discounts.view');
    expect(host.textContent).not.toContain('discounts.edit');
    expect(host.textContent).toContain('discounts.delete');

    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('discounts.view')) as HTMLButtonElement).click());
    expect(mocks.navigate).toHaveBeenCalledWith('/discounts/1');

    act(() => root.unmount());
    host.remove();
  });

  it('resets search to the first page synchronously while pagination remains independent', () => {
    mocks.useDiscounts.mockImplementation((filters) => pageWith([discount], (filters as { page: number }).page, 3));
    mocks.useDeleteDiscount.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { host, root } = renderPage();

    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.next') as HTMLButtonElement).click());
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: '', page: 2 });

    const search = host.querySelector('input[aria-label="discounts.search"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(search, 'SAVE');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: 'SAVE', page: 1 });

    act(() => root.unmount());
    host.remove();
  });

  it('returns to the prior page after deleting its only visible item', () => {
    mocks.useDiscounts.mockImplementation((filters) => pageWith([discount], (filters as { page: number }).page, 2));
    const mutate = vi.fn((_id: number, options: { onSuccess: () => void }) => options.onSuccess());
    mocks.useDeleteDiscount.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderPage();

    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.next') as HTMLButtonElement).click());
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: '', page: 2 });

    act(() => (host.querySelector('button[aria-label="discounts.actions"]') as HTMLButtonElement).click());
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.delete') as HTMLButtonElement).click());
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete') as HTMLButtonElement).click());
    expect(mutate).toHaveBeenCalledWith(1, expect.any(Object));
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: '', page: 1 });

    act(() => root.unmount());
    host.remove();
  });

  it('returns to page 1 after deleting the only visible item on page 2 of 3', () => {
    mocks.useDiscounts.mockImplementation((filters) => pageWith([discount], (filters as { page: number }).page, 3));
    const mutate = vi.fn((_id: number, options: { onSuccess: () => void }) => options.onSuccess());
    mocks.useDeleteDiscount.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderPage();

    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.next') as HTMLButtonElement).click());
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: '', page: 2 });

    act(() => (host.querySelector('button[aria-label="discounts.actions"]') as HTMLButtonElement).click());
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.delete') as HTMLButtonElement).click());
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete') as HTMLButtonElement).click());
    expect(mutate).toHaveBeenCalledWith(1, expect.any(Object));
    expect(mocks.useDiscounts).toHaveBeenLastCalledWith({ search: '', page: 1 });

    act(() => root.unmount());
    host.remove();
  });

  it('opens shared delete confirmation and deletes through the Task 2 hook', () => {
    mocks.useDiscounts.mockReturnValue(pageWith());
    const mutate = vi.fn((_id: number, options: { onSuccess: () => void }) => options.onSuccess());
    mocks.useDeleteDiscount.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderPage();

    act(() => (host.querySelector('button[aria-label="discounts.actions"]') as HTMLButtonElement).click());
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'discounts.delete') as HTMLButtonElement).click());
    expect(host.textContent).toContain('discounts.delete_title');
    expect(host.textContent).toContain('discounts.delete_warning');

    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete') as HTMLButtonElement).click());
    expect(mutate).toHaveBeenCalledWith(1, expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith('discounts.delete_success');

    act(() => root.unmount());
    host.remove();
  });
});
