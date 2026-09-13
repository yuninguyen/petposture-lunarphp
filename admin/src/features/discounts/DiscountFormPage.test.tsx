import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detail: { data: undefined as unknown, isLoading: false, isError: false, error: undefined as unknown },
  create: vi.fn(),
  update: vi.fn(),
  navigate: vi.fn(),
  collections: [{ id: 1, label: 'Dogs' }, { id: 2, label: 'Cats' }],
  products: [{ id: 101, name: 'Posture Collar' }, { id: 102, name: 'Ergonomic Leash' }],
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  useDiscount: () => mocks.detail,
  useCreateDiscount: () => ({ mutate: mocks.create, isPending: false }),
  useUpdateDiscount: () => ({ mutate: mocks.update, isPending: false }),
}));
vi.mock('@/features/products/api', () => ({
  useProductLookups: () => ({ collectionOptions: mocks.collections, isLoading: false }),
  useProducts: () => ({ data: { data: mocks.products }, isLoading: false }),
}));

import { AMOUNT_OFF_TYPE, type Discount } from './api';
import { DiscountFormPage } from './DiscountFormPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const discount = {
  id: 7, name: 'Existing sale', handle: 'existing-sale', coupon: 'SAVE', type: AMOUNT_OFF_TYPE,
  type_label: 'Amount off', supported: true, status: 'active', starts_at: '2026-08-31T12:34:00.000Z', ends_at: '2026-09-01T12:34:00.000Z',
  uses: 0, max_uses: 10, max_uses_per_user: 1, priority: 5, stop: true,
  data: { min_prices: { USD: 25 }, fixed_value: true, fixed_values: { USD: 4.5 } },
  applies_to: 'specific_collections',
  collection_ids: [1],
  collections: [{ id: 1, name: 'Dogs' }],
  product_ids: [],
  products: [],
  created_at: '2026-08-31T12:00:00.000Z', updated_at: '2026-08-31T12:00:00.000Z',
} as unknown as Discount;

function renderForm(path = '/discounts/new') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => root.render(
    createElement(QueryClientProvider, { client: queryClient },
      createElement(MemoryRouter, { initialEntries: [path] },
        createElement(Routes, null,
          createElement(Route, { path: '/discounts/new', element: createElement(DiscountFormPage) }),
          createElement(Route, { path: '/discounts/:id', element: createElement(DiscountFormPage) }),
        ),
      ),
    ),
  ));
  return { host, root };
}

function change(input: Element | null, value: string | boolean) {
  if (!input) throw new Error('Input was not rendered');
  const element = input as HTMLInputElement | HTMLSelectElement;
  if (typeof value === 'boolean') {
    act(() => element.click());
    return;
  }
  const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    descriptor?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function submit(host: HTMLElement) {
  act(() => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

function fillValidPercentage(host: HTMLElement) {
  change(host.querySelector('#discount-name'), 'Sale');
  change(host.querySelector('#discount-coupon'), 'SAVE10');
  change(host.querySelector('#discount-starts-at'), '2026-08-31T12:00');
  change(host.querySelector('#discount-percentage'), '10');
}

afterEach(() => {
  mocks.detail = { data: undefined, isLoading: false, isError: false, error: undefined };
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.navigate.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  document.body.innerHTML = '';
});

describe('DiscountFormPage', () => {
  it('renders Type selector on create and toggles fixed value', () => {
    const { host, root } = renderForm();
    expect(host.querySelector('#discount-type-selector')).toBeTruthy();
    expect(host.querySelector('#discount-fixed-value-usd')).toBeNull();
    expect(host.querySelector('#discount-percentage')).toBeTruthy();
    change(host.querySelector('#discount-fixed-value'), true);
    expect(host.querySelector('#discount-fixed-value-usd')).toBeTruthy();
    act(() => root.unmount());
  });

  it('renders read-only type badge on edit', () => {
    mocks.detail = { data: discount, isLoading: false, isError: false, error: undefined };
    const { host, root } = renderForm('/discounts/7');
    expect(host.querySelector('#discount-type-selector')).toBeNull();
    expect(host.textContent).toContain('discounts.type');
    expect(host.textContent).toContain('discounts.type_amount_off_products');
    act(() => root.unmount());
  });

  it.each([
    ['missing coupon', (host: HTMLElement) => change(host.querySelector('#discount-coupon'), '') , 'discounts.coupon_required'],
    ['percentage over 100', (host: HTMLElement) => change(host.querySelector('#discount-percentage'), '100.01'), 'discounts.percentage_maximum'],
    ['zero maximum uses', (host: HTMLElement) => {
      change(host.querySelector('#discount-has-max-uses'), true);
      change(host.querySelector('#discount-max-uses'), '0');
    }, 'discounts.positive_use_limit'],
    ['zero maximum uses per customer', (host: HTMLElement) => {
      change(host.querySelector('#discount-has-max-uses-per-user'), true);
      change(host.querySelector('#discount-max-uses-per-user'), '0');
    }, 'discounts.positive_use_limit'],
  ])('blocks %s before mutating', (_name, makeInvalid, message) => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    makeInvalid(host);
    submit(host);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain(message);
    act(() => root.unmount());
  });

  it('validates scoping: blocks specific_collections with 0 selected', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    change(host.querySelector('#discount-applies-to'), 'specific_collections');
    submit(host);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain('discounts.collections_required');
    act(() => root.unmount());
  });

  it('validates scoping: blocks specific_products with 0 selected', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    change(host.querySelector('#discount-applies-to'), 'specific_products');
    submit(host);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain('discounts.products_required');
    act(() => root.unmount());
  });

  it('submits specific_collections with selected collection IDs', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    change(host.querySelector('#discount-applies-to'), 'specific_collections');

    // Toggle the first collection checkbox
    const checkboxes = host.querySelectorAll('input[type="checkbox"]');
    // Find the one corresponding to the collection in SearchableMultiSelect
    const collectionCheckbox = Array.from(checkboxes).find(
      (cb) => cb.closest('label')?.textContent?.includes('Dogs')
    );
    expect(collectionCheckbox).toBeTruthy();
    act(() => (collectionCheckbox as HTMLInputElement).click());

    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      type: AMOUNT_OFF_TYPE,
      coupon: 'SAVE10',
      applies_to: 'specific_collections',
      collection_ids: [1],
      product_ids: [],
    }), expect.any(Object));
    act(() => root.unmount());
  });

  it('submits specific_products with selected product IDs', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    change(host.querySelector('#discount-applies-to'), 'specific_products');

    const checkboxes = host.querySelectorAll('input[type="checkbox"]');
    const productCheckbox = Array.from(checkboxes).find(
      (cb) => cb.closest('label')?.textContent?.includes('Posture Collar')
    );
    expect(productCheckbox).toBeTruthy();
    act(() => (productCheckbox as HTMLInputElement).click());

    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      type: AMOUNT_OFF_TYPE,
      coupon: 'SAVE10',
      applies_to: 'specific_products',
      collection_ids: [],
      product_ids: [101],
    }), expect.any(Object));
    act(() => root.unmount());
  });

  it('toggles usage limits and end date inputs with checkboxes', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);

    expect(host.querySelector('#discount-ends-at')).toBeNull();
    change(host.querySelector('#discount-has-end-date'), true);
    expect(host.querySelector('#discount-ends-at')).toBeTruthy();
    change(host.querySelector('#discount-ends-at'), '2026-09-01T12:00');

    expect(host.querySelector('#discount-max-uses')).toBeNull();
    change(host.querySelector('#discount-has-max-uses'), true);
    expect(host.querySelector('#discount-max-uses')).toBeTruthy();
    change(host.querySelector('#discount-max-uses'), '50');

    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      max_uses: 50,
      ends_at: expect.any(String),
    }), expect.any(Object));
    act(() => root.unmount());
  });

  it('toggles minimum purchase requirements via radio buttons', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);

    expect(host.querySelector('#discount-min-price-usd')).toBeNull();
    change(host.querySelector('#discount-min-req-amount'), true);
    expect(host.querySelector('#discount-min-price-usd')).toBeTruthy();
    change(host.querySelector('#discount-min-price-usd'), '35.50');

    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        min_prices: { USD: 35.5 },
      }),
    }), expect.any(Object));
    act(() => root.unmount());
  });

  it('rehydrates on edit and updates from specific_collections to all_products', () => {
    mocks.detail = { data: discount, isLoading: false, isError: false, error: undefined };
    const { host, root } = renderForm('/discounts/7');

    const appliesToSelect = host.querySelector('#discount-applies-to') as HTMLSelectElement;
    expect(appliesToSelect.value).toBe('specific_collections');

    // Switch to all_products
    change(appliesToSelect, 'all_products');
    submit(host);

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      payload: expect.objectContaining({
        applies_to: 'all_products',
        collection_ids: [],
        product_ids: [],
      }),
    }), expect.any(Object));
    act(() => root.unmount());
  });

  it('blocks malformed datetime input without throwing or mutating', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    const startsAt = host.querySelector('#discount-starts-at') as HTMLInputElement;
    startsAt.type = 'text';
    expect(() => change(startsAt, 'not-a-date')).not.toThrow();
    expect(() => submit(host)).not.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain('discounts.datetime_invalid');
    act(() => root.unmount());
  });

  it('shows 422 field messages in the alert instead of only a generic toast', () => {
    mocks.create.mockImplementation((_payload: unknown, options: { onError: (error: Error) => void }) => options.onError(Object.assign(new Error('Validation failed'), {
      status: 422,
      data: { errors: { coupon: ['The coupon has already been taken.'] } },
    })));
    const { host, root } = renderForm();
    fillValidPercentage(host);
    submit(host);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('The coupon has already been taken.');
    expect(toast.error).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('renders unsupported detail responses as read-only legacy content without mutation controls', () => {
    mocks.detail = { data: { ...discount, supported: false, type_label: 'Unsupported' }, isLoading: false, isError: false, error: undefined };
    const { host, root } = renderForm('/discounts/7');
    expect(host.textContent).toContain('discounts.unsupported_legacy');
    expect(host.querySelector('form')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('submits the default all_products percentage payload', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      type: AMOUNT_OFF_TYPE,
      coupon: 'SAVE10',
      applies_to: 'all_products',
      collection_ids: [],
      product_ids: [],
      data: { min_prices: { USD: null }, fixed_value: false, percentage: 10 },
    }), expect.any(Object));
    act(() => root.unmount());
  });
});
