import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detail: { data: undefined as unknown, isLoading: false, isError: false, error: undefined as unknown },
  create: vi.fn(),
  update: vi.fn(),
  navigate: vi.fn(),
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

import { AMOUNT_OFF_TYPE, type Discount } from './api';
import { DiscountFormPage } from './DiscountFormPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const discount = {
  id: 7, name: 'Existing sale', handle: 'existing-sale', coupon: 'SAVE', type: AMOUNT_OFF_TYPE,
  type_label: 'Amount off', supported: true, status: 'active', starts_at: '2026-08-31T12:34:00.000Z', ends_at: '2026-09-01T12:34:00.000Z',
  uses: 0, max_uses: 10, max_uses_per_user: 1, priority: 5, stop: true,
  data: { min_prices: { USD: 25 }, fixed_value: true, fixed_values: { USD: 4.5 } },
  created_at: '2026-08-31T12:00:00.000Z', updated_at: '2026-08-31T12:00:00.000Z',
} as Discount;

function renderForm(path = '/discounts/new') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null,
        createElement(Route, { path: '/discounts/new', element: createElement(DiscountFormPage) }),
        createElement(Route, { path: '/discounts/:id', element: createElement(DiscountFormPage) }),
      ),
    ),
  ));
  return { host, root };
}

function change(input: Element | null, value: string | boolean) {
  if (!input) throw new Error('Input was not rendered');
  const element = input as HTMLInputElement;
  if (typeof value === 'boolean') {
    act(() => element.click());
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
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
  it('renders only fixed-cart AmountOff configuration', () => {
    const { host, root } = renderForm();
    expect([...host.querySelectorAll('label')].map((label) => label.childNodes[0]?.textContent)).not.toContain('discounts.type');
    expect(host.querySelector('#discount-min-qty')).toBeNull();
    expect(host.querySelector('#discount-fixed-value-usd')).toBeNull();
    expect(host.querySelector('#discount-percentage')).toBeTruthy();
    change(host.querySelector('#discount-fixed-value'), true);
    expect(host.querySelector('#discount-fixed-value-usd')).toBeTruthy();
    act(() => root.unmount());
  });

  it.each([
    ['missing coupon', (host: HTMLElement) => change(host.querySelector('#discount-coupon'), '') , 'discounts.coupon_required'],
    ['percentage over 100', (host: HTMLElement) => change(host.querySelector('#discount-percentage'), '100.01'), 'discounts.percentage_maximum'],
    ['zero maximum uses', (host: HTMLElement) => change(host.querySelector('#discount-max-uses'), '0'), 'discounts.positive_use_limit'],
    ['zero maximum uses per customer', (host: HTMLElement) => change(host.querySelector('#discount-max-uses-per-user'), '0'), 'discounts.positive_use_limit'],
  ])('blocks %s before mutating', (_name, makeInvalid, message) => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    makeInvalid(host);
    submit(host);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain(message);
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

  it('submits the AmountOff-only percentage payload', () => {
    const { host, root } = renderForm();
    fillValidPercentage(host);
    submit(host);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      type: AMOUNT_OFF_TYPE,
      coupon: 'SAVE10',
      data: { min_prices: { USD: null }, fixed_value: false, percentage: 10 },
    }), expect.any(Object));
    act(() => root.unmount());
  });
});
