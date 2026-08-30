import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useReturnRequests: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, number>) => key === 'return_requests.page_of' ? `${values?.current} / ${values?.last}` : key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./api', () => ({ useReturnRequests: mocks.useReturnRequests }));

import { ReturnRequestsListPage } from './ReturnRequestsListPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function queryResult(page: number) {
  return {
    isLoading: false,
    isError: false,
    data: {
      data: [{ id: String(page), order_reference: `ORD-${page}`, status: 'requested', reason: 'Wrong size', items: [], refund_amount: null, restocking_fee: null, requested_at: null }],
      meta: { current_page: page, last_page: 3, per_page: 20, total: 60 },
    },
  };
}

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ReturnRequestsListPage)));
  return { host, root };
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setValue?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.useReturnRequests.mockReset().mockImplementation(({ page }: { status: string; page: number }) => queryResult(page));
});

describe('ReturnRequestsListPage', () => {
  it('navigates list pages and reflects the current page state', () => {
    const { host, root } = renderPage();

    expect(host.textContent).toContain('ORD-1');
    expect(host.textContent).toContain('1 / 3');
    const buttons = Array.from(host.querySelectorAll('button'));
    expect(buttons.find((button) => button.textContent === 'common.previous')).toHaveProperty('disabled', true);

    click(buttons.find((button) => button.textContent === 'common.next')!);

    expect(mocks.useReturnRequests).toHaveBeenLastCalledWith({ status: '', page: 2 });
    expect(host.textContent).toContain('ORD-2');
    expect(host.textContent).toContain('2 / 3');
    expect(buttons.find((button) => button.textContent === 'common.previous')).toHaveProperty('disabled', false);

    act(() => root.unmount());
    host.remove();
  });

  it('sends the canonical requested filter and resets to page one atomically', () => {
    const { host, root } = renderPage();
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.next')!);
    mocks.useReturnRequests.mockClear();

    changeSelect(host.querySelector('select')!, 'requested');

    expect(mocks.useReturnRequests).toHaveBeenCalledWith({ status: 'requested', page: 1 });
    expect(mocks.useReturnRequests).not.toHaveBeenCalledWith({ status: 'requested', page: 2 });
    expect(host.textContent).toContain('ORD-1');
    expect(host.textContent).toContain('1 / 3');

    act(() => root.unmount());
    host.remove();
  });
});
