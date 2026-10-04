import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';
import viLocale from '../../locales/vi.json';
import type { PaymentMethodsResponse, PaymentMethodState } from './api';

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
  GatewayForm: ({ gateway, webhookUrl, copyStatus, onCopyWebhookUrl, onSaved }: {
    gateway: PaymentMethodState;
    webhookUrl: string;
    copyStatus: 'copied' | 'error' | null;
    onCopyWebhookUrl(): void;
    onSaved(next: PaymentMethodState): void;
  }) => {
    const [candidate, setCandidate] = useState('');
    return (
      <div data-testid="gateway-form" data-gateway={gateway.gateway} data-copy-status={copyStatus ?? ''}>
        <label htmlFor="candidate">Candidate</label>
        <input id="candidate" value={candidate} onChange={(event) => setCandidate(event.target.value)} />
        <input aria-label="Mock webhook URL" readOnly value={webhookUrl} />
        <span>{gateway.label}</span>
        <button type="button" onClick={onCopyWebhookUrl}>Mock copy webhook URL</button>
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

const COD_ENABLED = { enabled: true };

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
    mocks.fetchJson.mockResolvedValue({ data: gateways.map((item) => ({ ...item, label: `API ${item.label}` })), cod: COD_ENABLED });
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
      cod: COD_ENABLED,
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
      cod: COD_ENABLED,
    });
    renderPage();

    await screen.findByTestId('gateway-form');
    expect(screen.getByRole('button', { name: /Stripe Configured Database/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PayPal Not configured Environment/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Airwallex Configured Mixed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payoneer Not configured None/ })).toBeInTheDocument();
  });

  it('passes the selected webhook URL and copy state through GatewayForm', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: COD_ENABLED });
    renderPage();

    const form = await screen.findByTestId('gateway-form');
    expect(screen.getByRole('textbox', { name: 'Mock webhook URL' })).toHaveValue('https://app.example.test/webhooks/stripe');
    expect(screen.queryByRole('textbox', { name: 'Webhook URL' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mock copy webhook URL' }));
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith('https://app.example.test/webhooks/stripe'));
    await waitFor(() => expect(form).toHaveAttribute('data-copy-status', 'copied'));

    fireEvent.click(screen.getByRole('button', { name: /PayPal/ }));
    expect(screen.getByRole('textbox', { name: 'Mock webhook URL' })).toHaveValue('https://app.example.test/webhooks/paypal');
  });

  it('switches gateways through desktop or mobile selectors and remounts candidate state', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: COD_ENABLED });
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
    let resolve!: (value: PaymentMethodsResponse) => void;
    mocks.fetchJson.mockReturnValueOnce(new Promise((next) => { resolve = next; }));
    const loading = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading payment methods…');
    resolve({ data: gateways, cod: COD_ENABLED });
    await screen.findByTestId('gateway-form');
    loading.unmount();

    mocks.fetchJson.mockRejectedValueOnce(new Error('Database host and token leaked'));
    const error = renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment methods could not be loaded.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Database host and token leaked');
    error.unmount();

    mocks.fetchJson.mockResolvedValueOnce({ data: [], cod: COD_ENABLED });
    renderPage();
    expect(await screen.findByText('No payment methods are available.')).toHaveAttribute('role', 'status');
  });

  it('replaces a saved gateway with fresh safe metadata in query data', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: COD_ENABLED });
    const { queryClient } = renderPage();
    await screen.findByTestId('gateway-form');

    fireEvent.click(screen.getByRole('button', { name: 'Mock save' }));

    await waitFor(() => expect(screen.getAllByText('Stripe updated').length).toBeGreaterThan(0));
    const cached = queryClient.getQueryData<PaymentMethodsResponse>(['admin', 'payment-methods']);
    expect(cached?.data.find((item) => item.gateway === 'stripe')?.label).toBe('Stripe updated');
    expect(JSON.stringify(cached)).not.toContain(SECRET_SENTINEL);
  });

  it('renders the COD toggle state and sends the PUT request when switched', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: { enabled: true } });
    renderPage();
    await screen.findByTestId('gateway-form');

    const toggle = screen.getByRole('switch', { name: /Enabled/ });
    expect(toggle).toBeChecked();

    mocks.fetchJson.mockResolvedValueOnce({ data: { enabled: false } });
    fireEvent.click(toggle);

    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/cod', {
      method: 'PUT',
      body: { enabled: false },
    }));
    await screen.findByRole('switch', { name: /Disabled/ });
  });

  it('starts the COD toggle unchecked when the server reports it disabled', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: { enabled: false } });
    renderPage();
    await screen.findByTestId('gateway-form');

    expect(screen.getByRole('switch', { name: /Disabled/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps checkout method rows in place after toggling one off', async () => {
    const methods = [
      { method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true },
      { method: 'cashapp', label: 'Cash App Pay', gateway: 'stripe', enabled: true, available: true, admin_enabled: true },
    ];
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string }) => (
      options?.method === 'PUT'
        ? { data: { ...methods[0], enabled: false, admin_enabled: false } }
        : { data: gateways, cod: COD_ENABLED, methods }
    ));
    renderPage();

    fireEvent.click(await screen.findByRole('switch', { name: 'Credit card Enabled' }));
    await screen.findByRole('switch', { name: 'Credit card Disabled' });

    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/methods/card', { method: 'PUT', body: { enabled: false } });
    expect(
      screen.getAllByRole('switch')
        .map((checkbox) => checkbox.getAttribute('aria-label'))
        .filter((label) => /Credit card|Cash App/.test(label ?? '')),
    ).toEqual(['Credit card Disabled', 'Cash App Pay Enabled']);
  });

  const catalogue = [
    { method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true },
    { method: 'google_pay', label: 'Google Pay', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true },
    { method: 'ach_debit', label: 'ACH Direct Debit', gateway: 'stripe', enabled: false, available: false, admin_enabled: false, supported: false },
    { method: 'paypal', label: 'PayPal', gateway: 'paypal', enabled: true, available: true, admin_enabled: true, supported: true },
    { method: 'venmo', label: 'Venmo', gateway: 'paypal', enabled: false, available: false, admin_enabled: false, supported: false },
  ];

  it('lists each gateway\'s own methods inside that gateway and locks the ones that are not supported yet', async () => {
    mocks.fetchJson.mockResolvedValue({ data: gateways, cod: COD_ENABLED, methods: catalogue });
    renderPage();

    await screen.findByRole('switch', { name: 'Credit card Enabled' });
    expect(screen.getByRole('switch', { name: 'Google Pay Enabled' })).toBeEnabled();
    expect(screen.queryByRole('switch', { name: /^PayPal/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'ACH Direct Debit Disabled' })).toBeDisabled();
    expect(screen.getByText('Not supported yet.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('gateway-selector')[1]);

    await screen.findByRole('switch', { name: 'PayPal Enabled' });
    expect(screen.queryByRole('switch', { name: /^Credit card/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Venmo Disabled' })).toBeDisabled();
  });

  it('shows what Stripe reports for each method and re-reads Stripe on request', async () => {
    const methods = [
      { method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true, stripe_status: 'on' },
      { method: 'klarna', label: 'Klarna', gateway: 'stripe', enabled: false, available: false, admin_enabled: true, supported: true, stripe_status: 'off' },
    ];
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string }) => (
      options?.method === 'POST'
        ? { data: { methods: [methods[0], { ...methods[1], stripe_status: 'on', enabled: true, available: true }], stripe_sync: { ok: true, checked_at: '2026-10-03T10:00:00Z' } } }
        : { data: gateways, cod: COD_ENABLED, methods, stripe_sync: { ok: true, checked_at: '2026-10-03T09:00:00Z' } }
    ));
    renderPage();

    expect(await screen.findByText('Off in Stripe')).toBeInTheDocument();
    expect(screen.getByText('On in Stripe')).toBeInTheDocument();
    expect(screen.getByText('Hidden at checkout')).toBeInTheDocument();
    // Stripe's state never flips this site's own switch.
    expect(screen.getByRole('switch', { name: 'Klarna Enabled' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Stripe' }));

    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/stripe-sync', { method: 'POST' }));
    await waitFor(() => expect(screen.queryByText('Off in Stripe')).not.toBeInTheDocument());
    expect(screen.queryByText('Hidden at checkout')).not.toBeInTheDocument();
  });

  it('shows what the Airwallex account can offer and re-reads it from the Airwallex tab only', async () => {
    const methods = [
      { method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true, stripe_status: 'on' },
      { method: 'airwallex_klarna', label: 'Klarna', gateway: 'airwallex', enabled: false, available: false, admin_enabled: false, supported: false, airwallex_status: 'on' },
      { method: 'airwallex_affirm', label: 'Affirm', gateway: 'airwallex', enabled: false, available: false, admin_enabled: false, supported: false, airwallex_status: 'unavailable' },
    ];
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string }) => (
      options?.method === 'POST'
        ? { data: { methods: [methods[0], { ...methods[1], airwallex_status: 'off' }, methods[2]], airwallex_sync: { ok: true, checked_at: '2026-10-03T10:00:00Z' } } }
        : { data: gateways, cod: COD_ENABLED, methods, stripe_sync: { ok: true, checked_at: '2026-10-03T09:00:00Z' }, airwallex_sync: { ok: true, checked_at: '2026-10-03T09:00:00Z' } }
    ));
    renderPage();

    await screen.findByText('On in Stripe');
    expect(screen.getByRole('button', { name: 'Refresh from Stripe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh from Airwallex' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('gateway-selector')[2]);

    expect(await screen.findByText('On in Airwallex')).toBeInTheDocument();
    expect(screen.getByText('Not active in Airwallex')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh from Stripe' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Airwallex' }));

    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/airwallex-sync', { method: 'POST' }));
    expect(await screen.findByText('Off in Airwallex')).toBeInTheDocument();
  });

  it('says so when Stripe could not be read and offers no Stripe state', async () => {
    mocks.fetchJson.mockResolvedValue({
      data: gateways,
      cod: COD_ENABLED,
      methods: [{ method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true, stripe_status: null }],
      stripe_sync: { ok: false, checked_at: null },
    });
    renderPage();

    expect(await screen.findByText(/read Stripe/)).toBeInTheDocument();
    expect(screen.queryByText(/in Stripe$/)).not.toBeInTheDocument();
  });

  it('saves the card logo selection when a brand is ticked or unticked', async () => {
    const card_brands = { enabled: ['visa', 'mastercard'], available: ['visa', 'mastercard', 'amex'] };
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string; body?: { brands: string[] } }) => (
      options?.method === 'PUT'
        ? { data: { ...card_brands, enabled: options.body?.brands ?? [] } }
        : { data: gateways, cod: COD_ENABLED, methods: catalogue, card_brands }
    ));
    renderPage();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'American Express' }));
    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/card-brands', { method: 'PUT', body: { brands: ['visa', 'mastercard', 'amex'] } }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'American Express' })).toBeChecked());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Visa' }));
    await waitFor(() => expect(mocks.fetchJson).toHaveBeenLastCalledWith('/admin/finance/payment-methods/card-brands', { method: 'PUT', body: { brands: ['mastercard', 'amex'] } }));
  });

  it('gives the Airwallex card its own logo selection, saved for the Airwallex gateway only', async () => {
    const card_brands = { enabled: ['visa', 'mastercard', 'amex'], available: ['visa', 'mastercard', 'amex'] };
    const airwallex_card_brands = { enabled: ['visa'], available: ['visa', 'mastercard', 'amex'] };
    const methods = [
      { method: 'card', label: 'Credit card', gateway: 'stripe', enabled: true, available: true, admin_enabled: true, supported: true },
      { method: 'airwallex', label: 'Credit or Debit Card (Airwallex)', gateway: 'airwallex', enabled: true, available: true, admin_enabled: true, supported: true },
    ];
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string; body?: { brands: string[] } }) => (
      options?.method === 'PUT'
        ? { data: { ...airwallex_card_brands, enabled: options.body?.brands ?? [] } }
        : { data: gateways, cod: COD_ENABLED, methods, card_brands, airwallex_card_brands }
    ));
    renderPage();

    await screen.findByRole('checkbox', { name: 'American Express' });
    expect(screen.getByText(/set in your Stripe account/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('gateway-selector')[2]);

    expect(await screen.findByText(/set in your Airwallex account/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Visa' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Mastercard' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mastercard' }));
    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/card-brands', { method: 'PUT', body: { gateway: 'airwallex', brands: ['visa', 'mastercard'] } }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mastercard' })).toBeChecked());
  });
});
