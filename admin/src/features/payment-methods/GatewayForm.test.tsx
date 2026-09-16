import { act, createElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  testPaymentMethod: vi.fn(),
  updatePaymentMethod: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  testPaymentMethod: mocks.testPaymentMethod,
  updatePaymentMethod: mocks.updatePaymentMethod,
}));

import { GatewayForm } from './GatewayForm';
import type { PaymentGateway, PaymentMethodState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const definitions: Record<PaymentGateway, { mode: string; connection: string[]; webhook: string }> = {
  stripe: { mode: 'test', connection: ['stripe_secret'], webhook: 'stripe_webhook_secret' },
  paypal: { mode: 'sandbox', connection: ['paypal_client_id', 'paypal_client_secret'], webhook: 'paypal_webhook_id' },
  airwallex: { mode: 'sandbox', connection: ['airwallex_client_id', 'airwallex_api_key'], webhook: 'airwallex_webhook_secret' },
  payoneer: { mode: 'sandbox', connection: ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret'], webhook: 'payoneer_webhook_secret' },
};

function gatewayState(gateway: PaymentGateway): PaymentMethodState {
  const fieldKeys = {
    stripe: ['stripe_key', 'stripe_secret', 'stripe_webhook_secret'],
    paypal: ['paypal_client_id', 'paypal_client_secret', 'paypal_webhook_id'],
    airwallex: ['airwallex_client_id', 'airwallex_api_key', 'airwallex_webhook_secret'],
    payoneer: ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret', 'payoneer_webhook_secret'],
  }[gateway];
  return {
    gateway,
    label: gateway,
    configured: true,
    source: 'database',
    mode: definitions[gateway].mode,
    webhook_url: `https://example.test/${gateway}`,
    fields: Object.fromEntries(fieldKeys.map((key) => [key, {
      ...(key.includes('client_id') || key.includes('merchant_code') || key === 'stripe_key' ? { value: `${key}-stored` } : {}),
      configured: true,
      source: 'database' as const,
      hint: 'Configured in database.',
    }])),
  };
}

function renderForm(gateway = gatewayState('stripe')) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onSaved = vi.fn();
  act(() => root.render(createElement(GatewayForm, { gateway, onSaved })));
  return { host, root, onSaved, gateway };
}

function setInput(host: HTMLElement, id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function saveButton(host: HTMLElement) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Save')!;
}

function testButton(host: HTMLElement) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Test connection')!;
}

async function click(button: HTMLButtonElement) {
  await act(async () => button.click());
}

function cleanup(rendered: ReturnType<typeof renderForm>) {
  act(() => rendered.root.unmount());
  rendered.host.remove();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('GatewayForm', () => {
  it('prefills non-secret fields, keeps secrets blank, and starts with Save disabled', () => {
    const rendered = renderForm(gatewayState('paypal'));
    expect(rendered.host.querySelector<HTMLInputElement>('#paypal-paypal_client_id')?.value).toBe('paypal_client_id-stored');
    expect(rendered.host.querySelector<HTMLInputElement>('#paypal-paypal_client_secret')?.value).toBe('');
    expect(rendered.host.querySelector<HTMLInputElement>('#paypal-paypal_webhook_id')?.value).toBe('');
    expect(saveButton(rendered.host).disabled).toBe(true);
    cleanup(rendered);
  });

  it.each(Object.entries(definitions) as [PaymentGateway, (typeof definitions)[PaymentGateway]][])('classifies connection and webhook fields exactly for %s', async (gateway, definition) => {
    for (const key of definition.connection) {
      const rendered = renderForm(gatewayState(gateway));
      setInput(rendered.host, `${gateway}-${key}`, `${key}-candidate`);
      expect(saveButton(rendered.host).disabled).toBe(true);
      cleanup(rendered);
    }

    const webhook = renderForm(gatewayState(gateway));
    setInput(webhook.host, `${gateway}-${definition.webhook}`, 'webhook-only-candidate');
    expect(saveButton(webhook.host).disabled).toBe(false);
    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: webhook.gateway });
    await click(saveButton(webhook.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith(gateway, { fields: { [definition.webhook]: 'webhook-only-candidate' } });
    cleanup(webhook);
  });

  it('requires a successful current test, rejects failed authorization, and revokes success after a connection change', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    setInput(rendered.host, 'paypal-paypal_client_secret', 'candidate-one');
    expect(saveButton(rendered.host).disabled).toBe(true);

    mocks.testPaymentMethod.mockRejectedValueOnce(new Error('Connection test failed.'));
    await click(testButton(rendered.host));
    expect(saveButton(rendered.host).disabled).toBe(true);

    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'paypal', status: 'connected', message: 'PayPal connection verified.', mode: 'sandbox' } });
    await click(testButton(rendered.host));
    expect(saveButton(rendered.host).disabled).toBe(false);

    setInput(rendered.host, 'paypal-paypal_client_secret', 'candidate-two');
    expect(saveButton(rendered.host).disabled).toBe(true);
    cleanup(rendered);
  });

  it('keeps a successful test current across webhook changes and saves connection plus webhook together', async () => {
    const rendered = renderForm(gatewayState('stripe'));
    setInput(rendered.host, 'stripe-stripe_secret', 'stripe-candidate');
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'stripe', status: 'connected', message: 'Stripe connection verified.', mode: 'test' } });
    await click(testButton(rendered.host));
    setInput(rendered.host, 'stripe-stripe_webhook_secret', 'webhook-candidate');
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenCalledWith('stripe', {
      fields: { stripe_secret: 'stripe-candidate', stripe_webhook_secret: 'webhook-candidate' },
    });
    cleanup(rendered);
  });

  it('allows confirmed clear-only saves, removes replacements from clear, and omits blank secrets', async () => {
    const rendered = renderForm(gatewayState('stripe'));
    const clear = Array.from(rendered.host.querySelectorAll<HTMLButtonElement>('[data-action="remove-override"]')).find(
      (button) => button.closest('div')?.querySelector('label')?.textContent === 'Secret key',
    )!;
    await click(clear);
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('stripe', { clear_fields: ['stripe_secret'] });

    const replacement = renderForm(gatewayState('stripe'));
    await click(Array.from(replacement.host.querySelectorAll<HTMLButtonElement>('[data-action="remove-override"]')).find(
      (button) => button.closest('div')?.querySelector('label')?.textContent === 'Secret key',
    )!);
    setInput(replacement.host, 'stripe-stripe_secret', 'replacement-after-clear');
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'stripe', status: 'connected', message: 'ok', mode: 'test' } });
    await click(testButton(replacement.host));
    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: replacement.gateway });
    await click(saveButton(replacement.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('stripe', { fields: { stripe_secret: 'replacement-after-clear' } });
    expect(JSON.stringify(mocks.updatePaymentMethod.mock.lastCall)).not.toContain('clear_fields');
    cleanup(rendered);
    cleanup(replacement);
  });

  it('sends only mode and non-empty connection candidates to Test', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    const mode = rendered.host.querySelector<HTMLSelectElement>('#paypal-mode')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(mode, 'live');
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    setInput(rendered.host, 'paypal-paypal_client_id', 'new-client');
    setInput(rendered.host, 'paypal-paypal_webhook_id', 'must-not-be-tested');
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'paypal', status: 'connected', message: 'ok', mode: 'live' } });
    await click(testButton(rendered.host));
    expect(mocks.testPaymentMethod).toHaveBeenCalledWith('paypal', { mode: 'live', fields: { paypal_client_id: 'new-client' } });
    cleanup(rendered);
  });

  it('resets candidate, clear, and test state from fresh server metadata after save', async () => {
    const rendered = renderForm(gatewayState('stripe'));
    setInput(rendered.host, 'stripe-stripe_secret', 'sensitive-candidate');
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'stripe', status: 'connected', message: 'verified', mode: 'test' } });
    await click(testButton(rendered.host));
    expect(rendered.host.textContent).toContain('verified');

    const next = gatewayState('stripe');
    next.fields.stripe_secret = { configured: true, source: 'environment', hint: 'Configured by environment.' };
    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: next });
    await click(saveButton(rendered.host));
    act(() => rendered.root.render(createElement(GatewayForm, { gateway: next, onSaved: rendered.onSaved })));

    expect(rendered.onSaved).toHaveBeenCalledWith(next);
    expect(rendered.host.querySelector<HTMLInputElement>('#stripe-stripe_secret')?.value).toBe('');
    expect(rendered.host.textContent).not.toContain('verified');
    expect(rendered.host.textContent).not.toContain('marked for removal');
    expect(saveButton(rendered.host).disabled).toBe(true);
    cleanup(rendered);
  });

  it('keeps candidate credentials out of query cache, storage, URL, and visible status', async () => {
    const sentinel = 'candidate-never-cache-store-toast-url';
    const queryClient = new QueryClient();
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const rendered = renderForm(gatewayState('stripe'));
    setInput(rendered.host, 'stripe-stripe_secret', sentinel);
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'stripe', status: 'connected', message: 'Connection verified.', mode: 'test' } });
    await click(testButton(rendered.host));

    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(sentinel);
    expect(localSet).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining(sentinel));
    expect(window.location.href).not.toContain(sentinel);
    expect(rendered.host.textContent).not.toContain(sentinel);
    expect(mocks.testPaymentMethod).toHaveBeenCalledWith('stripe', { mode: 'test', fields: { stripe_secret: sentinel } });
    queryClient.clear();
    cleanup(rendered);
  });

  it('clears a non-secret database override with the approved warning and payload', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    const clientIdClear = rendered.host.querySelector<HTMLButtonElement>('[data-action="remove-override"][data-field="paypal_client_id"]')!;

    await click(clientIdClear);

    expect(window.confirm).toHaveBeenCalledWith('Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.');
    expect(rendered.host.querySelector<HTMLInputElement>('#paypal-paypal_client_id')?.disabled).toBe(true);
    expect(rendered.host.textContent).toContain('This does not remove or disable the environment value.');
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('paypal', { clear_fields: ['paypal_client_id'] });
    cleanup(rendered);
  });

  it('undoes a non-secret clear and requires a current test for its replacement', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    await click(rendered.host.querySelector<HTMLButtonElement>('[data-action="remove-override"][data-field="paypal_client_id"]')!);

    const undo = rendered.host.querySelector<HTMLButtonElement>('[data-action="undo-remove-override"][data-field="paypal_client_id"]')!;
    await click(undo);
    expect(rendered.host.querySelector<HTMLInputElement>('#paypal-paypal_client_id')?.disabled).toBe(false);
    expect(rendered.host.textContent).not.toContain('This does not remove or disable the environment value.');

    setInput(rendered.host, 'paypal-paypal_client_id', 'replacement-client');
    expect(saveButton(rendered.host).disabled).toBe(true);
    mocks.testPaymentMethod.mockResolvedValueOnce({ data: { gateway: 'paypal', status: 'connected', message: 'Connected.', mode: 'sandbox' } });
    await click(testButton(rendered.host));
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('paypal', { fields: { paypal_client_id: 'replacement-client' } });
    cleanup(rendered);
  });

  it('allows a connection candidate converted to clear to save without an obsolete test', async () => {
    const rendered = renderForm(gatewayState('stripe'));
    setInput(rendered.host, 'stripe-stripe_secret', 'temporary-candidate');
    expect(saveButton(rendered.host).disabled).toBe(true);

    await click(Array.from(rendered.host.querySelectorAll<HTMLButtonElement>('[data-action="remove-override"]')).find(
      (button) => button.closest('div')?.querySelector('label')?.textContent === 'Secret key',
    )!);
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('stripe', { clear_fields: ['stripe_secret'] });
    cleanup(rendered);
  });

  it('allows webhook-only save after reverting a connection value to its stored value', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    setInput(rendered.host, 'paypal-paypal_client_id', 'temporary-client');
    expect(saveButton(rendered.host).disabled).toBe(true);
    setInput(rendered.host, 'paypal-paypal_client_id', 'paypal_client_id-stored');
    setInput(rendered.host, 'paypal-paypal_webhook_id', 'webhook-after-revert');
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('paypal', { fields: { paypal_webhook_id: 'webhook-after-revert' } });
    cleanup(rendered);
  });

  it('directly invalidates mode changes and removes the test requirement after mode revert', async () => {
    const rendered = renderForm(gatewayState('paypal'));
    const mode = rendered.host.querySelector<HTMLSelectElement>('#paypal-mode')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(mode, 'live');
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(saveButton(rendered.host).disabled).toBe(true);

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(mode, 'sandbox');
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    setInput(rendered.host, 'paypal-paypal_webhook_id', 'webhook-after-mode-revert');
    expect(saveButton(rendered.host).disabled).toBe(false);

    mocks.updatePaymentMethod.mockResolvedValueOnce({ data: rendered.gateway });
    await click(saveButton(rendered.host));
    expect(mocks.updatePaymentMethod).toHaveBeenLastCalledWith('paypal', { fields: { paypal_webhook_id: 'webhook-after-mode-revert' } });
    cleanup(rendered);
  });

  it('shows the Payoneer presence-only limitation', () => {
    const rendered = renderForm(gatewayState('payoneer'));
    expect(rendered.host.textContent).toContain('Payoneer can confirm that credentials are present, but cannot verify connectivity.');
    cleanup(rendered);
  });
});
