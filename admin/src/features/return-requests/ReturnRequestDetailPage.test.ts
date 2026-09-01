import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), approve: vi.fn(), reject: vi.fn(), complete: vi.fn(), addTracking: vi.fn(), approveWaiver: vi.fn(), preview: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(), status: 'requested' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: '42' }) }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('./api', () => ({
  useReturnRequest: () => ({ isLoading: false, isError: false, data: { id: '42', order_reference: 'ORD-42', status: mocks.status, reason: 'Wrong size', customer_note: 'Too small', admin_note: null, rma_address: null, refund_amount: 10, restocking_fee: 1, fee_waived: false, requested_at: '2026-08-30T12:00:00Z', approved_at: null, rejected_at: null, completed_at: null, items: [{ order_line_id: '1', description: 'Harness', option: 'M', quantity: 1 }] } }),
  useApproveReturnRequest: () => ({ mutateAsync: mocks.approve, isPending: false }),
  useRejectReturnRequest: () => ({ mutateAsync: mocks.reject, isPending: false }),
  useCompleteReturnRequest: () => ({ mutateAsync: mocks.complete, isPending: false }),
  useAddReturnTracking: () => ({ mutateAsync: mocks.addTracking, isPending: false }),
  useApproveLowValueWaiver: () => ({ mutateAsync: mocks.approveWaiver, isPending: false }),
  previewReturnRequest: (...args: unknown[]) => mocks.preview(...args),
}));

import { ReturnRequestDetailPage } from './ReturnRequestDetailPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ReturnRequestDetailPage)));
  return { host, root };
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setChecked(element: HTMLInputElement, checked: boolean) {
  if (element.checked !== checked) act(() => element.click());
}

async function confirm(host: HTMLElement) {
  await act(async () => {
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.confirm')!);
  });
}

beforeEach(() => {
  mocks.status = 'requested';
  mocks.navigate.mockReset();
  mocks.approve.mockReset().mockResolvedValue({ id: '42' });
  mocks.reject.mockReset().mockResolvedValue({ id: '42' });
  mocks.complete.mockReset().mockResolvedValue({ id: '42' });
  mocks.addTracking.mockReset().mockResolvedValue({ id: '42' });
  mocks.approveWaiver.mockReset().mockResolvedValue({ id: '42' });
  mocks.preview.mockReset().mockResolvedValue({ item_subtotal: 10, tax: 0, restocking_fee: 1, estimated_refund: 9 });
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

describe('ReturnRequestDetailPage', () => {
  it('shows approve and reject only for requested return requests', () => {
    const { host, root } = renderPage();
    const buttons = Array.from(host.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttons).toContain('return_requests.approve');
    expect(buttons).toContain('return_requests.reject');
    expect(buttons).not.toContain('return_requests.complete');
    act(() => root.unmount());
    host.remove();
  });

  it('shows complete only for approved return requests', () => {
    mocks.status = 'approved';
    const { host, root } = renderPage();
    const buttons = Array.from(host.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttons).not.toContain('return_requests.approve');
    expect(buttons).not.toContain('return_requests.reject');
    expect(buttons).toContain('return_requests.complete');
    act(() => root.unmount());
    host.remove();
  });

  it('requires an RMA address before approving and submits all optional approval values', async () => {
    const { host, root } = renderPage();
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'return_requests.approve')!);

    await confirm(host);
    expect(mocks.toastError).toHaveBeenCalledWith('return_requests.rma_address_required');
    expect(mocks.approve).not.toHaveBeenCalled();

    const textareas = host.querySelectorAll('textarea');
    setValue(textareas[0], ' Warehouse 3 ');
    setChecked(host.querySelector('input[type="checkbox"]')!, true);
    setValue(host.querySelector('input[type="number"]')!, '12.50');
    setValue(textareas[1], ' Carrier confirmed damage ');
    await confirm(host);

    expect(mocks.approve).toHaveBeenCalledWith({ id: '42', payload: { rma_address: 'Warehouse 3', fee_waived: true, refund_amount: 12.5, admin_note: 'Carrier confirmed damage' } });
    act(() => root.unmount());
    host.remove();
  });

  it('shows a mutation error and retains the approval dialog and form values', async () => {
    mocks.approve.mockRejectedValueOnce(new Error('Approval failed'));
    const { host, root } = renderPage();
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'return_requests.approve')!);
    setValue(host.querySelector('textarea')!, 'Warehouse 3');

    await confirm(host);

    expect(mocks.toastError).toHaveBeenCalledWith('Approval failed');
    expect(host.textContent).toContain('return_requests.approve');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Warehouse 3');
    act(() => root.unmount());
    host.remove();
  });

  it('submits the reject confirmation payload', async () => {
    const { host, root } = renderPage();
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'return_requests.reject')!);
    setValue(host.querySelector('textarea')!, 'Not eligible under policy');

    await confirm(host);

    expect(mocks.reject).toHaveBeenCalledWith({ id: '42', payload: { admin_note: 'Not eligible under policy' } });
    act(() => root.unmount());
    host.remove();
  });

  it('submits the complete confirmation with the request id', async () => {
    mocks.status = 'approved';
    const { host, root } = renderPage();
    click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'return_requests.complete')!);

    await confirm(host);

    expect(mocks.complete).toHaveBeenCalledWith({ id: '42' });
    act(() => root.unmount());
    host.remove();
  });
});
