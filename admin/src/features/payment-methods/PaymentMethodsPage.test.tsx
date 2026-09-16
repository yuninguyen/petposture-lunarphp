import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentMethodState } from './api';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));
vi.mock('./GatewayForm', () => ({
  GatewayForm: ({ gateway, onSaved }: { gateway: PaymentMethodState; onSaved(next: PaymentMethodState): void }) => {
    const [candidate, setCandidate] = useState('');
    return (
      <div data-testid="gateway-form" data-gateway={gateway.gateway}>
        <label htmlFor="candidate">Candidate</label>
        <input id="candidate" value={candidate} onChange={(event) => setCandidate(event.target.value)} />
        <span>{gateway.label}</span>
        <button type="button" onClick={() => onSaved({ ...gateway, label: `${gateway.label} updated` })}>Mock save</button>
      </div>
    );
  },
}));

import { PaymentMethodsPage } from './PaymentMethodsPage';

const SECRET_SENTINEL = 'secret-must-never-render';

function gateway(gateway: PaymentMethodState['gateway'], label: string): PaymentMethodState {
  return {
    gateway,
    label,
    configured: true,
    source: 'database',
    mode: gateway === 'stripe' ? 'test' : 'sandbox',
    webhook_url: `https://app.example.test/webhooks/${gateway}`,
    fields: {
      [`${gateway}_safe`]: { configured: true, source: 'database', hint: 'Configured in database' },
    },
  };
}

const gateways = [
  gateway('stripe', 'Stripe'),
  gateway('paypal', 'PayPal'),
  gateway('airwallex', 'Airwallex'),
  gateway('payoneer', 'Payoneer'),
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <PaymentMethodsPage />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('PaymentMethodsPage', () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
  });

  afterEach(() => cleanup());

  it('renders exactly the four approved gateway selectors without credentials or provider requests', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways });
    const { container } = renderPage();

    await screen.findByTestId('gateway-form');
    expect(screen.getAllByTestId('gateway-selector')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Stripe/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PayPal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Airwallex/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payoneer/ })).toBeInTheDocument();
    expect(screen.queryByText(/pingpong/i)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain(SECRET_SENTINEL);

    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods');
    for (const [url] of mocks.fetchJson.mock.calls) {
      expect(url).toMatch(/^\/admin\/finance\/payment-methods/);
      expect(url).not.toMatch(/stripe\.com|paypal\.com|airwallex\.com|payoneer\.com/i);
    }
  });

  it('switches gateways through desktop or mobile selectors and remounts candidate state', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways });
    renderPage();

    const candidate = await screen.findByLabelText('Candidate');
    fireEvent.change(candidate, { target: { value: 'request-only-candidate' } });
    expect(candidate).toHaveValue('request-only-candidate');

    fireEvent.click(screen.getByRole('button', { name: /PayPal/ }));
    expect(screen.getByTestId('gateway-form')).toHaveAttribute('data-gateway', 'paypal');
    expect(screen.getByLabelText('Candidate')).toHaveValue('');

    fireEvent.change(screen.getByRole('combobox', { name: 'Payment gateway' }), { target: { value: 'airwallex' } });
    expect(screen.getByTestId('gateway-form')).toHaveAttribute('data-gateway', 'airwallex');
  });

  it('renders accessible loading, error, and empty states', async () => {
    let resolve!: (value: { data: PaymentMethodState[] }) => void;
    mocks.fetchJson.mockReturnValueOnce(new Promise((next) => { resolve = next; }));
    const loading = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading payment methods…');
    resolve({ data: gateways });
    await screen.findByTestId('gateway-form');
    loading.unmount();

    mocks.fetchJson.mockRejectedValueOnce(new Error('Safe loading failure'));
    const error = renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Safe loading failure');
    error.unmount();

    mocks.fetchJson.mockResolvedValueOnce({ data: [] });
    renderPage();
    expect(await screen.findByText('No payment methods are available.')).toHaveAttribute('role', 'status');
  });

  it('replaces a saved gateway with fresh safe metadata in query data', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways });
    const { queryClient } = renderPage();
    await screen.findByTestId('gateway-form');

    fireEvent.click(screen.getByRole('button', { name: 'Mock save' }));

    await waitFor(() => expect(screen.getAllByText('Stripe updated').length).toBeGreaterThan(0));
    const cached = queryClient.getQueryData<PaymentMethodState[]>(['admin', 'payment-methods']);
    expect(cached?.find((item) => item.gateway === 'stripe')?.label).toBe('Stripe updated');
    expect(JSON.stringify(cached)).not.toContain(SECRET_SENTINEL);
  });
});
