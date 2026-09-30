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
});

describe('ExpressCheckout', () => {
    it('renders nothing when no Stripe instance is provided', () => {
        const element = render(<ExpressCheckout {...baseProps} />);
        expect(element.childElementCount).toBe(0);
    });

    it('renders the mount point hidden (not absent) when availability has not resolved yet, so Stripe has a container to mount into', () => {
        const element = render(<ExpressCheckout {...baseProps} stripeInstance={{} as never} />);
        const wrapper = element.firstElementChild as HTMLElement | null;
        expect(wrapper).not.toBeNull();
        expect(wrapper?.style.visibility).toBe('hidden');
    });

    it('creates a Stripe Express Checkout Element with the item subtotal and PayPal folded in as a payment method', () => {
        const expressCheckoutElement = { mount: vi.fn(), on: vi.fn() };
        const elementsGroup = { create: vi.fn().mockReturnValue(expressCheckoutElement), submit: vi.fn(), update: vi.fn() };
        const stripeInstance = { elements: vi.fn().mockReturnValue(elementsGroup), confirmPayment: vi.fn() };

        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} />);

        expect(stripeInstance.elements).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'payment',
            amount: 2000,
            currency: 'usd',
        }));
        expect(elementsGroup.create).toHaveBeenCalledWith('expressCheckout', expect.objectContaining({
            paymentMethods: expect.objectContaining({ applePay: 'always', googlePay: 'always', paypal: 'auto' }),
            layout: expect.objectContaining({ maxColumns: 3 }),
            buttonType: expect.objectContaining({ googlePay: 'plain' }),
        }));
        // The element must mount synchronously in the same pass it's created,
        // not deferred until canExpressPay is true -- the
        // 'availablepaymentmethodschange' event (which sets canExpressPay)
        // only fires after mounting, so a deferred mount deadlocks and the
        // element never renders anything.
        expect(expressCheckoutElement.mount).toHaveBeenCalled();
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

    it('creates the order through existing endpoints when the wallet confirms payment (covers Apple Pay, Google Pay, and PayPal alike, since Stripe confirms all three as the same kind of PaymentIntent)', async () => {
        const fetchMock = vi.mocked(fetchApi);
        const calls: string[] = [];
        fetchMock.mockImplementation((endpoint) => {
            calls.push(endpoint);
            if (endpoint.includes('/api/checkout/payment-intent')) {
                return Promise.resolve({ ok: true, json: async () => ({ payment_intent: { intent_id: 'pi_1', client_secret: 'secret_1' } }) } as Response);
            }
            if (endpoint.includes('/api/checkout/place-order')) {
                return Promise.resolve({ status: 201, json: async () => ({ order: { reference: 'EX-1', tracking_access_token: 'tok-1' } }) } as Response);
            }
            return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
        });

        type ConfirmEvent = {
            billingDetails?: { name?: string; email?: string; phone?: string; address?: Record<string, string> };
            shippingAddress?: { name?: string; address?: Record<string, string> };
            paymentFailed: (payload: { reason?: string; message?: string }) => void;
        };
        let confirmHandler: ((event: ConfirmEvent) => Promise<void>) | undefined;
        const expressCheckoutElement = {
            mount: vi.fn(),
            on: vi.fn((event: string, handler: unknown) => {
                if (event === 'confirm') confirmHandler = handler as (event: ConfirmEvent) => Promise<void>;
            }),
        };
        const elementsGroup = { create: vi.fn().mockReturnValue(expressCheckoutElement), submit: vi.fn().mockResolvedValue({}), update: vi.fn() };
        const confirmPayment = vi.fn().mockResolvedValue({});
        const stripeInstance = { elements: vi.fn().mockReturnValue(elementsGroup), confirmPayment };

        const onOrderPlaced = vi.fn();
        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} onOrderPlaced={onOrderPlaced} />);

        await act(async () => {
            await confirmHandler?.({
                billingDetails: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '555', address: {} },
                shippingAddress: { name: 'Ada Lovelace', address: { line1: '1 Infinite Loop', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } },
                paymentFailed: vi.fn(),
            });
        });

        expect(elementsGroup.submit).toHaveBeenCalled();
        expect(calls.some((endpoint) => endpoint.includes('/api/checkout/payment-intent'))).toBe(true);
        expect(confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'secret_1' }));
        expect(calls.some((endpoint) => endpoint.includes('/api/checkout/place-order'))).toBe(true);
        expect(onOrderPlaced).toHaveBeenCalledWith({ reference: 'EX-1', trackingToken: 'tok-1' });
    });
});
