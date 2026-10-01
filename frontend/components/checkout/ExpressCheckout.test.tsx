// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/fetchApi', () => ({ fetchApi: vi.fn() }));

import { fetchApi } from '../../lib/fetchApi';
import { ExpressCheckout } from './ExpressCheckout';

const baseProps = {
    items: [{ variantId: 1, quantity: 1 }],
    couponCode: null,
    subtotalMinor: 2000,
    stripeInstance: null,
    paypalClientId: null,
    paypalEnvironment: 'production' as const,
    onOrderPlaced: vi.fn(),
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(ui));
    return container;
}

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    delete (window as { paypal?: unknown }).paypal;
    document.getElementById('paypal-v6-sdk')?.remove();
});

async function flushMicrotasks(times = 6) {
    for (let i = 0; i < times; i += 1) {
        await Promise.resolve();
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe('ExpressCheckout', () => {
    it('renders nothing when no wallet method is available', () => {
        const element = render(<ExpressCheckout {...baseProps} />);
        expect(element.childElementCount).toBe(0);
    });

    it('does not show the express checkout label just because a stripeInstance prop is present', () => {
        const element = render(<ExpressCheckout {...baseProps} stripeInstance={{} as never} />);
        expect(element.textContent).not.toContain('Express checkout');
    });

    it('creates two independent Stripe Express Checkout Elements -- one restricted to Apple Pay, one to Google Pay -- so they render as equal-width buttons instead of one bundled, unevenly-packed cell', () => {
        const expressCheckoutElement = { mount: vi.fn(), on: vi.fn() };
        const elementsGroup = { create: vi.fn().mockReturnValue(expressCheckoutElement), submit: vi.fn(), update: vi.fn() };
        const stripeInstance = { elements: vi.fn().mockReturnValue(elementsGroup), confirmPayment: vi.fn() };

        // paypalClientId is included because canPayPal (derived from it)
        // gates whether the component renders anything on the very first
        // pass -- matching production, where PayPal is always configured.
        // Without it, neither Stripe mount <div> would exist yet either,
        // since nothing would be known to be available.
        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} paypalClientId="test-client-id" />);

        expect(stripeInstance.elements).toHaveBeenCalledTimes(2);
        expect(stripeInstance.elements).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'payment',
            amount: 2000,
            currency: 'usd',
        }));
        expect(elementsGroup.create).toHaveBeenCalledTimes(2);
        expect(elementsGroup.create).toHaveBeenCalledWith('expressCheckout', expect.objectContaining({
            paymentMethods: expect.objectContaining({ applePay: 'always', googlePay: 'never', paypal: 'never' }),
        }));
        expect(elementsGroup.create).toHaveBeenCalledWith('expressCheckout', expect.objectContaining({
            paymentMethods: expect.objectContaining({ applePay: 'never', googlePay: 'always', paypal: 'never' }),
            buttonType: expect.objectContaining({ googlePay: 'plain' }),
        }));
        // Both elements must mount synchronously in the same pass they're
        // created, not deferred until their own canPay state is true -- the
        // 'availablepaymentmethodschange' event (which sets that state)
        // only fires after mounting, so a deferred mount deadlocks and the
        // element never renders anything.
        expect(expressCheckoutElement.mount).toHaveBeenCalledTimes(2);
    });

    it('recalculates shipping and tax through the existing endpoints when the wallet reports an address', async () => {
        const fetchMock = vi.mocked(fetchApi);
        fetchMock.mockImplementation((endpoint) => {
            if (endpoint.includes('/api/checkout/shipping-rates')) {
                return Promise.resolve({ ok: true, json: async () => ({ rates: [{ code: 'standard', name: 'Standard', price_minor: 500 }] }) } as Response);
            }
            return Promise.resolve({ ok: true, json: async () => ({ quote: { rate_percentage: 8, tax_amount: 250 } }) } as Response);
        });

        type ShippingAddressChangeEvent = {
            address: { city?: string; state?: string; postal_code?: string; country?: string };
            resolve: (payload: Record<string, unknown>) => void;
            reject: () => void;
        };
        let shippingAddressHandler: ((event: ShippingAddressChangeEvent) => Promise<void>) | undefined;
        const expressCheckoutElement = {
            mount: vi.fn(),
            on: vi.fn((event: string, handler: unknown) => {
                if (event === 'shippingaddresschange') shippingAddressHandler = handler as (event: ShippingAddressChangeEvent) => Promise<void>;
            }),
        };
        const elementsGroup = { create: vi.fn().mockReturnValue(expressCheckoutElement), submit: vi.fn(), update: vi.fn() };
        const stripeInstance = { elements: vi.fn().mockReturnValue(elementsGroup), confirmPayment: vi.fn() };

        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} subtotalMinor={2000} />);
        const resolve = vi.fn();
        await act(async () => {
            await shippingAddressHandler?.({
                address: { country: 'US', state: 'TX', city: 'Austin', postal_code: '78701' },
                resolve,
                reject: vi.fn(),
            });
        });

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/checkout/shipping-rates'));
        expect(elementsGroup.update).toHaveBeenCalledWith({ amount: 2000 + 500 + 250 });
        expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
            shippingRates: [expect.objectContaining({ id: 'standard', amount: 500 })],
        }));
    });

    it('injects the v6 SDK script for the configured environment when PayPal is not already loaded', () => {
        render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" paypalEnvironment="sandbox" />);
        const script = document.getElementById('paypal-v6-sdk') as HTMLScriptElement | null;
        expect(script?.src).toBe('https://www.sandbox.paypal.com/web-sdk/v6/core');
    });

    it('mounts the logo-only PayPal button while eligibility is still resolving', async () => {
        const eligibility = deferred<{ isEligible: (method: string) => boolean }>();
        const findEligibleMethods = vi.fn().mockReturnValue(eligibility.promise);
        const createPayPalOneTimePaymentSession = vi.fn().mockReturnValue({ start: vi.fn() });
        const createInstance = vi.fn().mockResolvedValue({ findEligibleMethods, createPayPalOneTimePaymentSession });
        window.paypal = { createInstance } as never;

        const element = render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" />);
        await act(async () => { await flushMicrotasks(); });

        expect(createInstance).toHaveBeenCalledWith(expect.objectContaining({
            clientId: 'test-client-id',
            components: ['paypal-payments'],
        }));
        expect(findEligibleMethods).toHaveBeenCalledWith({ currencyCode: 'USD' });
        expect(createPayPalOneTimePaymentSession).toHaveBeenCalledTimes(1);
        expect(element.querySelector('button[aria-label="Pay with PayPal"] img[alt="PayPal"]')).not.toBeNull();

        await act(async () => { eligibility.resolve({ isEligible: () => true }); await eligibility.promise; });
    });

    it('removes the optimistic PayPal button when eligibility resolves false', async () => {
        const eligibility = deferred<{ isEligible: (method: string) => boolean }>();
        const findEligibleMethods = vi.fn().mockReturnValue(eligibility.promise);
        const createPayPalOneTimePaymentSession = vi.fn().mockReturnValue({ start: vi.fn() });
        window.paypal = { createInstance: vi.fn().mockResolvedValue({ findEligibleMethods, createPayPalOneTimePaymentSession }) } as never;

        const element = render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" />);
        await act(async () => { await flushMicrotasks(); });
        expect(element.querySelector('button[aria-label="Pay with PayPal"]')).not.toBeNull();

        await act(async () => { eligibility.resolve({ isEligible: () => false }); await eligibility.promise; });
        expect(element.querySelector('button[aria-label="Pay with PayPal"]')).toBeNull();
    });

    it('removes the optimistic PayPal button when eligibility rejects', async () => {
        const eligibility = deferred<{ isEligible: (method: string) => boolean }>();
        const findEligibleMethods = vi.fn().mockReturnValue(eligibility.promise);
        const createPayPalOneTimePaymentSession = vi.fn().mockReturnValue({ start: vi.fn() });
        window.paypal = { createInstance: vi.fn().mockResolvedValue({ findEligibleMethods, createPayPalOneTimePaymentSession }) } as never;

        const element = render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" />);
        await act(async () => { await flushMicrotasks(); });
        expect(element.querySelector('button[aria-label="Pay with PayPal"]')).not.toBeNull();

        await act(async () => { eligibility.reject(new Error('eligibility failed')); await eligibility.promise.catch(() => undefined); });
        expect(element.querySelector('button[aria-label="Pay with PayPal"]')).toBeNull();
    });

    it('patches the PayPal order amount through the new amount endpoint when the wallet reports a shipping address', async () => {
        const fetchMock = vi.mocked(fetchApi);
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, totals: {} }) } as Response);

        let sessionOptions: Record<string, unknown> = {};
        const createPayPalOneTimePaymentSession = vi.fn((options: Record<string, unknown>) => {
            sessionOptions = options;
            return { start: vi.fn() };
        });
        const findEligibleMethods = vi.fn().mockResolvedValue({ isEligible: () => true });
        window.paypal = { createInstance: vi.fn().mockResolvedValue({ findEligibleMethods, createPayPalOneTimePaymentSession }) } as never;

        render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" />);
        await act(async () => { await flushMicrotasks(); });

        const onShippingAddressChange = sessionOptions.onShippingAddressChange as (data: {
            orderId: string;
            shippingAddress: { city?: string; countryCode: string; postalCode?: string; state?: string };
        }) => Promise<void>;
        await act(async () => {
            await onShippingAddressChange({ orderId: 'PAYPAL-1', shippingAddress: { countryCode: 'US', state: 'TX', city: 'Austin', postalCode: '78701' } });
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/checkout/paypal-order/amount', expect.objectContaining({
            method: 'POST',
            body: expect.objectContaining({
                paypal_order_id: 'PAYPAL-1',
                shipping: { country: 'US', state: 'TX', city: 'Austin', postcode: '78701' },
            }),
        }));
    });

    it('fetches shipping details, places the order, and captures payment through existing endpoints on PayPal approval', async () => {
        const fetchMock = vi.mocked(fetchApi);
        const calls: string[] = [];
        fetchMock.mockImplementation((endpoint) => {
            calls.push(endpoint);
            if (endpoint.includes('/api/checkout/paypal-order/shipping')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ shipping: { email: 'a@b.com', first_name: 'A', last_name: 'B', line_one: '1 Main St', line_two: null, city: 'Austin', state: 'TX', postcode: '78701', country: 'US', phone: null } }),
                } as Response);
            }
            if (endpoint.includes('/api/checkout/place-order')) return Promise.resolve({ status: 201, json: async () => ({ order: { reference: 'PP-1', tracking_access_token: 'tok-1' } }) } as Response);
            return Promise.resolve({ ok: true, json: async () => ({ capture: { status: 'COMPLETED' } }) } as Response);
        });

        let sessionOptions: Record<string, unknown> = {};
        const createPayPalOneTimePaymentSession = vi.fn((options: Record<string, unknown>) => {
            sessionOptions = options;
            return { start: vi.fn() };
        });
        const findEligibleMethods = vi.fn().mockResolvedValue({ isEligible: () => true });
        window.paypal = { createInstance: vi.fn().mockResolvedValue({ findEligibleMethods, createPayPalOneTimePaymentSession }) } as never;

        const onOrderPlaced = vi.fn();
        render(<ExpressCheckout {...baseProps} paypalClientId="test-client-id" onOrderPlaced={onOrderPlaced} />);
        await act(async () => { await flushMicrotasks(); });

        const onApprove = sessionOptions.onApprove as (data: { orderId: string }) => Promise<void>;
        await act(async () => { await onApprove({ orderId: 'PAYPAL-1' }); });

        expect(calls.some((endpoint) => endpoint.includes('/api/checkout/paypal-order/shipping'))).toBe(true);
        expect(calls.some((endpoint) => endpoint.includes('/api/checkout/place-order'))).toBe(true);
        expect(calls.some((endpoint) => endpoint.includes('/api/checkout/paypal-capture'))).toBe(true);
        expect(onOrderPlaced).toHaveBeenCalledWith({ reference: 'PP-1', trackingToken: 'tok-1' });
    });
});
