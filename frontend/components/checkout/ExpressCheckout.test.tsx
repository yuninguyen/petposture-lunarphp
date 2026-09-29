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
    it('renders nothing when no wallet method is available', () => {
        const element = render(<ExpressCheckout {...baseProps} />);
        expect(element.childElementCount).toBe(0);
    });

    it('does not show the express checkout label just because a stripeInstance prop is present', () => {
        const element = render(<ExpressCheckout {...baseProps} stripeInstance={{} as never} />);
        expect(element.textContent).not.toContain('Express checkout');
    });

    it('creates a Stripe payment request with the item subtotal when a Stripe instance is provided', () => {
        const paymentRequest = { canMakePayment: vi.fn().mockResolvedValue(null), on: vi.fn(), update: vi.fn() };
        const stripeInstance = {
            paymentRequest: vi.fn().mockReturnValue(paymentRequest),
            elements: vi.fn().mockReturnValue({ create: vi.fn().mockReturnValue({ mount: vi.fn(), on: vi.fn() }) }),
        };

        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} />);

        expect(stripeInstance.paymentRequest).toHaveBeenCalledWith(expect.objectContaining({
            country: 'US',
            currency: 'usd',
            total: { label: 'PetPosture', amount: 2000 },
            requestPayerName: true,
            requestPayerEmail: true,
            requestShipping: true,
        }));
    });

    it('recalculates shipping and tax through the existing endpoints when the wallet reports an address', async () => {
        const fetchMock = vi.mocked(fetchApi);
        fetchMock.mockImplementation((endpoint) => {
            if (endpoint.includes('/api/checkout/shipping-rates')) {
                return Promise.resolve({ ok: true, json: async () => ({ rates: [{ code: 'standard', name: 'Standard', price_minor: 500 }] }) } as Response);
            }
            return Promise.resolve({ ok: true, json: async () => ({ quote: { rate_percentage: 8, tax_amount: 250 } }) } as Response);
        });

        type ShippingAddressEvent = {
            shippingAddress: { country: string; region: string; city: string; postalCode: string };
            updateWith: (details: Record<string, unknown>) => void;
        };
        let shippingAddressHandler: ((event: ShippingAddressEvent) => Promise<void>) | undefined;
        const paymentRequest = {
            canMakePayment: vi.fn().mockResolvedValue({ applePay: true }),
            on: vi.fn((event: string, handler: unknown) => {
                if (event === 'shippingaddresschange') shippingAddressHandler = handler as (event: ShippingAddressEvent) => Promise<void>;
            }),
        };
        const stripeInstance = {
            paymentRequest: vi.fn().mockReturnValue(paymentRequest),
            elements: vi.fn().mockReturnValue({ create: vi.fn().mockReturnValue({ mount: vi.fn() }) }),
        };

        render(<ExpressCheckout {...baseProps} stripeInstance={stripeInstance as never} subtotalMinor={2000} />);
        const updateWith = vi.fn();
        await act(async () => {
            await shippingAddressHandler?.({
                shippingAddress: { country: 'US', region: 'TX', city: 'Austin', postalCode: '78701' },
                updateWith,
            });
        });

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/checkout/shipping-rates'));
        expect(updateWith).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success',
            total: expect.objectContaining({ amount: 2750 }),
        }));
    });
});
