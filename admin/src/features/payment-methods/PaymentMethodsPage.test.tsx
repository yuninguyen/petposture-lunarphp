import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';
import viLocale from '../../locales/vi.json';
import type { PaymentMethodState } from './api';

let language: 'en' | 'vi' = 'en';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), writeText: vi.fn() }));

vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => (
      (language === 'vi' ? viLocale : en)[key as keyof typeof en] ?? options?.defaultValue ?? key
    ),
  }),
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
    language = 'en';
    mocks.fetchJson.mockReset();
    mocks.writeText.mockReset();
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  afterEach(() => cleanup());

  it('uses translated gateway names instead of hardcoded API labels', async () => {
    language = 'vi';
    mocks.fetchJson.mockResolvedValue({ data: gateways.map((item) => ({ ...item, label: `API ${item.label}` })) });
    renderPage();

    await screen.findByTestId('gateway-form');
    expect(screen.getAllByTestId('gateway-selector').map((selector) => selector.querySelector('span')?.textContent)).toEqual([
      viLocale['payment_methods.gateways.stripe'],
      viLocale['payment_methods.gateways.paypal'],
      viLocale['payment_methods.gateways.airwallex'],
      viLocale['payment_methods.gateways.payoneer'],
    ]);
    expect(screen.getByRole('combobox', { name: viLocale['payment_methods.gateway'] })).toHaveDisplayValue(viLocale['payment_methods.gateways.stripe']);
  });

  it('renders the approved gateways once in fixed order despite shuffled duplicates and unknown gateways', async () => {
    const pingPong = { ...gateway('stripe', 'PingPong'), gateway: 'pingpong' } as unknown as PaymentMethodState;
    mocks.fetchJson.mockResolvedValue({
      data: [
        gateways[2],
        gateways[1],
        gateways[0],
        { ...gateways[1], label: 'Duplicate PayPal' },
        pingPong,
        gateways[3],
        { ...gateways[0], label: 'Duplicate Stripe' },
      ],
    });
    const { container } = renderPage();

    await screen.findByTestId('gateway-form');
    expect(screen.getAllByTestId('gateway-selector')).toHaveLength(4);
    expect(screen.getAllByTestId('gateway-selector').map((selector) => selector.querySelector('span')?.textContent)).toEqual([
      'Stripe',
      'PayPal',
      'Airwallex',
      'Payoneer',
    ]);
    expect(screen.getByRole('combobox', { name: 'Payment gateway' })).toHaveDisplayValue('Stripe');
    expect(screen.queryByText(/pingpong|duplicate/i)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain(SECRET_SENTINEL);

    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods');
    for (const [url] of mocks.fetchJson.mock.calls) {
      expect(url).toMatch(/^\/admin\/finance\/payment-methods/);
      expect(url).not.toMatch(/stripe\.com|paypal\.com|airwallex\.com|payoneer\.com/i);
    }
  });

  it('shows configuration and source badges for every approved gateway', async () => {
    mocks.fetchJson.mockResolvedValue({
      data: [
        gateways[0],
        { ...gateways[1], configured: false, source: 'environment' },
        { ...gateways[2], source: 'mixed' },
        { ...gateways[3], configured: false, source: 'none' },
      ],
    });
    renderPage();

    await screen.findByTestId('gateway-form');
    expect(screen.getByRole('button', { name: /Stripe Configured Database/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PayPal Not configured Environment/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Airwallex Configured Mixed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payoneer Not configured None/ })).toBeInTheDocument();
  });

  it('renders a read-only webhook URL and copies the selected gateway URL', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways });
    renderPage();

    const webhook = await screen.findByRole('textbox', { name: 'Webhook URL' });
    expect(webhook).toHaveValue('https://app.example.test/webhooks/stripe');
    expect(webhook).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Copy webhook URL' }));
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith('https://app.example.test/webhooks/stripe'));
    expect(screen.getByRole('status')).toHaveTextContent('Webhook URL copied.');

    fireEvent.click(screen.getByRole('button', { name: /PayPal/ }));
    expect(screen.getByRole('textbox', { name: 'Webhook URL' })).toHaveValue('https://app.example.test/webhooks/paypal');
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

    mocks.fetchJson.mockRejectedValueOnce(new Error('Database host and token leaked'));
    const error = renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment methods could not be loaded.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Database host and token leaked');
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
