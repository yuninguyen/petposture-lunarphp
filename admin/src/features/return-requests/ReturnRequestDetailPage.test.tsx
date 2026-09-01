import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useReturnRequest: vi.fn(),
  useApproveReturnRequest: vi.fn(),
  useRejectReturnRequest: vi.fn(),
  useCompleteReturnRequest: vi.fn(),
  useAddReturnTracking: vi.fn(),
  useApproveLowValueWaiver: vi.fn(),
  previewReturnRequest: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: 'return-42' }) }));
vi.mock('./api', () => ({
  useReturnRequest: (...args: unknown[]) => mocks.useReturnRequest(...args),
  useApproveReturnRequest: () => mocks.useApproveReturnRequest(),
  useRejectReturnRequest: () => mocks.useRejectReturnRequest(),
  useCompleteReturnRequest: () => mocks.useCompleteReturnRequest(),
  useAddReturnTracking: () => mocks.useAddReturnTracking(),
  useApproveLowValueWaiver: () => mocks.useApproveLowValueWaiver(),
  previewReturnRequest: (...args: unknown[]) => mocks.previewReturnRequest(...args),
}));

import { ReturnRequestDetailPage } from './ReturnRequestDetailPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const request = (overrides: Record<string, unknown> = {}) => ({
  id: 'return-42', order_reference: 'PP-0042', reason: 'Damaged', status: 'requested', customer_note: null,
  admin_note: null, rma_address: null, refund_amount: 12.5, restocking_fee: null, fee_waived: false,
  requested_at: null, approved_at: null, rejected_at: null, completed_at: null, items: [],
  return_tracking_number: null, return_carrier: null, return_tracking_url: null,
  low_value_auto_waive_eligible: false,
  ...overrides,
});

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ReturnRequestDetailPage)));
  return { host, root };
}

function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll('button')].find((element) => element.textContent === label) as HTMLButtonElement;
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useApproveReturnRequest.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(request()) });
  mocks.useRejectReturnRequest.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(request()) });
  mocks.useCompleteReturnRequest.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(request()) });
  mocks.useAddReturnTracking.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(request()) });
  mocks.useApproveLowValueWaiver.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(request({ status: 'waived' })) });
  mocks.previewReturnRequest.mockResolvedValue({ item_subtotal: 10, tax: 1.5, restocking_fee: 2, estimated_refund: 9.5 });
});

describe('ReturnRequestDetailPage', () => {
  it('shows tracking only for untracked approved requests and submits the required number with manual carrier by default', async () => {
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ status: 'approved' }) });
    const { host, root } = renderPage();

    expect(button(host, 'return_requests.add_tracking')).toBeTruthy();
    await act(async () => button(host, 'return_requests.add_tracking').click());
    expect(host.querySelector('.fixed')?.textContent).toContain('return_requests.confirm_tracking');
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.useAddReturnTracking().mutateAsync).not.toHaveBeenCalled();

    const trackingNumber = host.querySelector('input') as HTMLInputElement;
    await act(async () => setControlValue(trackingNumber, '1Z999'));
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.useAddReturnTracking().mutateAsync).toHaveBeenCalledWith({ id: 'return-42', payload: { tracking_number: '1Z999', carrier: 'manual' } });
    await act(async () => button(host, 'return_requests.add_tracking').click());
    const carrier = host.querySelector('select') as HTMLSelectElement;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(carrier, 'ups');
    await act(async () => carrier.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => setControlValue(host.querySelector('input') as HTMLInputElement, '1Z998'));
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.useAddReturnTracking().mutateAsync).toHaveBeenLastCalledWith({ id: 'return-42', payload: { tracking_number: '1Z998', carrier: 'ups' } });
    act(() => root.unmount()); host.remove();
  });

  it('does not show tracking for non-approved or already tracked requests', () => {
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request() });
    const first = renderPage();
    expect(button(first.host, 'return_requests.add_tracking')).toBeFalsy();
    act(() => first.root.unmount()); first.host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ status: 'approved', return_tracking_number: '1Z999' }) });
    const second = renderPage();
    expect(button(second.host, 'return_requests.add_tracking')).toBeFalsy();
    act(() => second.root.unmount()); second.host.remove();
  });

  it('shows the waiver action only for eligible requested requests, submits its optional note, and displays waived status', async () => {
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ low_value_auto_waive_eligible: true }) });
    const { host, root } = renderPage();
    expect(button(host, 'return_requests.refund_no_return_required')).toBeTruthy();
    await act(async () => button(host, 'return_requests.refund_no_return_required').click());
    const note = host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => setControlValue(note, 'Low value'));
    await act(async () => button(host, 'common.confirm').click());
    expect(mocks.useApproveLowValueWaiver().mutateAsync).toHaveBeenCalledWith({ id: 'return-42', payload: { admin_note: 'Low value' } });
    act(() => root.unmount()); host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ low_value_auto_waive_eligible: false }) });
    const ineligible = renderPage();
    expect(button(ineligible.host, 'return_requests.refund_no_return_required')).toBeFalsy();
    act(() => ineligible.root.unmount()); ineligible.host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ status: 'waived', low_value_auto_waive_eligible: true }) });
    const waived = renderPage();
    expect(waived.host.textContent).toContain('return_requests.status_waived');
    expect(button(waived.host, 'return_requests.refund_no_return_required')).toBeFalsy();
    act(() => waived.root.unmount()); waived.host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ low_value_auto_waive_eligible: 'true' }) });
    const nonBooleanEligibility = renderPage();
    expect(button(nonBooleanEligibility.host, 'return_requests.refund_no_return_required')).toBeFalsy();
    act(() => nonBooleanEligibility.root.unmount()); nonBooleanEligibility.host.remove();
  });

  it('shows the locale-backed admin note for approve, reject, and waiver but not complete or tracking', async () => {
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ low_value_auto_waive_eligible: true }) });
    const requested = renderPage();
    for (const action of ['return_requests.approve', 'return_requests.reject', 'return_requests.refund_no_return_required']) {
      await act(async () => button(requested.host, action).click());
      expect(requested.host.querySelector('.fixed')?.textContent).toContain('return_requests.admin_note');
      await act(async () => button(requested.host, 'common.cancel').click());
    }
    act(() => requested.root.unmount()); requested.host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ status: 'approved' }) });
    const approved = renderPage();
    for (const action of ['return_requests.complete', 'return_requests.add_tracking']) {
      await act(async () => button(approved.host, action).click());
      expect(approved.host.querySelector('.fixed')?.textContent).not.toContain('return_requests.admin_note');
      await act(async () => button(approved.host, 'common.cancel').click());
    }
    act(() => approved.root.unmount()); approved.host.remove();
  });

  it('loads a server preview on approve open and fee-waived changes without calculating values client-side', async () => {
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request() });
    const { host, root } = renderPage();
    await act(async () => button(host, 'return_requests.approve').click());
    expect(mocks.previewReturnRequest).toHaveBeenCalledWith('return-42', { fee_waived: false });
    expect(host.textContent).toContain('$10.00');
    expect(host.textContent).toContain('$2.00');
    expect(host.textContent).toContain('$9.50');
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => checkbox.click());
    expect(mocks.previewReturnRequest).toHaveBeenLastCalledWith('return-42', { fee_waived: true });
    act(() => root.unmount()); host.remove();
  });

  it('keeps approve usable when preview fails and preserves approve, reject, and complete requests', async () => {
    mocks.previewReturnRequest.mockRejectedValue(new Error('preview unavailable'));
    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request() });
    const requested = renderPage();
    await act(async () => button(requested.host, 'return_requests.approve').click());
    expect(requested.host.textContent).toContain('return_requests.preview_error');
    expect(button(requested.host, 'common.confirm').disabled).toBe(false);
    const address = requested.host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => setControlValue(address, 'RMA'));
    await act(async () => button(requested.host, 'common.confirm').click());
    expect(mocks.useApproveReturnRequest().mutateAsync).toHaveBeenCalledWith({ id: 'return-42', payload: { rma_address: 'RMA', fee_waived: undefined, refund_amount: undefined, admin_note: undefined } });
    await act(async () => button(requested.host, 'return_requests.reject').click());
    await act(async () => button(requested.host, 'common.confirm').click());
    expect(mocks.useRejectReturnRequest().mutateAsync).toHaveBeenCalledWith({ id: 'return-42', payload: { admin_note: undefined } });
    act(() => requested.root.unmount()); requested.host.remove();

    mocks.useReturnRequest.mockReturnValue({ isLoading: false, isError: false, data: request({ status: 'approved' }) });
    const approved = renderPage();
    expect(button(approved.host, 'return_requests.complete')).toBeTruthy();
    await act(async () => button(approved.host, 'return_requests.complete').click());
    await act(async () => button(approved.host, 'common.confirm').click());
    expect(mocks.useCompleteReturnRequest().mutateAsync).toHaveBeenCalledWith({ id: 'return-42' });
    act(() => approved.root.unmount()); approved.host.remove();
  });
});
