// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildAffirmPaymentData,
    buildAfterpayClearpayPaymentData,
    isStripeAltPaymentMethod,
    buildCashAppPaymentData,
    buildKlarnaPaymentData,
    confirmStripeAltPayment,
    isStripeAltPaymentMethodEligible,
} from './stripeAltPaymentMethods';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('isStripeAltPaymentMethodEligible', () => {
    it('hides methods below the minimum and above the maximum', () => {
        expect(isStripeAltPaymentMethodEligible({ method: 'affirm', enabled: true, min_amount_minor: 3500, max_amount_minor: 3000000 }, 3499)).toBe(false);
        expect(isStripeAltPaymentMethodEligible({ method: 'klarna', enabled: true, min_amount_minor: 0, max_amount_minor: 400000 }, 400001)).toBe(false);
    });

    it('includes amounts at the inclusive minimum and maximum', () => {
        expect(isStripeAltPaymentMethodEligible({ method: 'affirm', enabled: true, min_amount_minor: 3500, max_amount_minor: 3000000 }, 3500)).toBe(true);
        expect(isStripeAltPaymentMethodEligible({ method: 'affirm', enabled: true, min_amount_minor: 3500, max_amount_minor: 3000000 }, 3000000)).toBe(true);
    });

    it('treats null bounds as unbounded and always hides disabled methods', () => {
        expect(isStripeAltPaymentMethodEligible({ method: 'cashapp', enabled: true, min_amount_minor: null, max_amount_minor: null }, 1)).toBe(true);
        expect(isStripeAltPaymentMethodEligible({ method: 'cashapp', enabled: false, min_amount_minor: null, max_amount_minor: null }, 1)).toBe(false);
    });

    it('maps Affirm billing details into the Stripe.js call without re-sending shipping the server already set', async () => {
        const stripe = {
            confirmAffirmPayment: vi.fn().mockResolvedValue({}),
            confirmKlarnaPayment: vi.fn(),
            confirmCashappPayment: vi.fn(),
        };
        const stripeFactory = vi.fn().mockReturnValue(stripe);
        vi.stubGlobal('Stripe', stripeFactory);
        const stripeInstance = window.Stripe?.('pk_test');
        const returnUrl = 'https://shop.example/checkout/success?gateway=stripe&session_id=STRIPE-TEST';

        await confirmStripeAltPayment(stripeInstance as NonNullable<typeof stripeInstance>, 'affirm', 'pi_secret', buildAffirmPaymentData({
            email: 'jane@example.com',
            billing: { first_name: 'Jane', last_name: 'Doe', line_one: '1 Main St', line_two: 'Unit 2', city: 'Austin', state: 'TX', postcode: '78701', country: 'United States' },
            returnUrl,
        }));

        expect(stripeFactory).toHaveBeenCalledWith('pk_test');
        expect(stripe.confirmAffirmPayment).toHaveBeenCalledWith('pi_secret', {
            payment_method: { billing_details: {
                email: 'jane@example.com',
                name: 'Jane Doe',
                address: { line1: '1 Main St', line2: 'Unit 2', city: 'Austin', state: 'TX', country: 'US', postal_code: '78701' },
            } },
            return_url: returnUrl,
        });
        expect(stripe.confirmAffirmPayment.mock.calls[0][1]).not.toHaveProperty('shipping');
    });

    it('sends only billing details and the return URL to confirmAfterpayClearpayPayment', async () => {
        const stripe = {
            confirmAffirmPayment: vi.fn(),
            confirmAfterpayClearpayPayment: vi.fn().mockResolvedValue({}),
            confirmKlarnaPayment: vi.fn(),
            confirmCashappPayment: vi.fn(),
        };
        vi.stubGlobal('Stripe', vi.fn().mockReturnValue(stripe));
        const stripeInstance = window.Stripe?.('pk_test');
        const returnUrl = 'https://shop.example/checkout/success?gateway=stripe&session_id=STRIPE-TEST';

        await confirmStripeAltPayment(stripeInstance as NonNullable<typeof stripeInstance>, 'afterpay_clearpay', 'pi_secret', buildAfterpayClearpayPaymentData({
            email: 'jane@example.com',
            billing: { first_name: 'Jane', last_name: 'Doe', line_one: '1 Main St', city: 'Austin', state: 'TX', postcode: '78701', country: 'United States' },
            returnUrl,
        }));

        expect(stripe.confirmAfterpayClearpayPayment).toHaveBeenCalledWith('pi_secret', {
            payment_method: { billing_details: {
                email: 'jane@example.com',
                name: 'Jane Doe',
                address: { line1: '1 Main St', city: 'Austin', state: 'TX', country: 'US', postal_code: '78701' },
            } },
            return_url: returnUrl,
        });
        expect(stripe.confirmAfterpayClearpayPayment.mock.calls[0][1]).not.toHaveProperty('shipping');
        expect(stripe.confirmAffirmPayment).not.toHaveBeenCalled();
    });

    it('recognises exactly the Stripe alternative methods', () => {
        for (const method of ['cashapp', 'affirm', 'afterpay_clearpay', 'klarna']) {
            expect(isStripeAltPaymentMethod(method)).toBe(true);
        }
        for (const method of ['card', 'paypal', 'cod', 'apple_pay', 'afterpay']) {
            expect(isStripeAltPaymentMethod(method)).toBe(false);
        }
    });

    it('passes the Klarna and Cash App Pay argument shapes to their Stripe.js methods', async () => {
        const stripe = {
            confirmAffirmPayment: vi.fn(),
            confirmKlarnaPayment: vi.fn().mockResolvedValue({}),
            confirmCashappPayment: vi.fn().mockResolvedValue({}),
        };
        vi.stubGlobal('Stripe', vi.fn().mockReturnValue(stripe));
        const stripeInstance = window.Stripe?.('pk_test');
        const returnUrl = 'https://shop.example/checkout/success?gateway=stripe&session_id=STRIPE-TEST';

        await confirmStripeAltPayment(stripeInstance as NonNullable<typeof stripeInstance>, 'klarna', 'pi_klarna_secret', buildKlarnaPaymentData(returnUrl));
        await confirmStripeAltPayment(stripeInstance as NonNullable<typeof stripeInstance>, 'cashapp', 'pi_cashapp_secret', buildCashAppPaymentData(returnUrl));

        expect(stripe.confirmKlarnaPayment).toHaveBeenCalledWith('pi_klarna_secret', { return_url: returnUrl });
        expect(stripe.confirmCashappPayment).toHaveBeenCalledWith('pi_cashapp_secret', {
            payment_method: { type: 'cashapp' },
            return_url: returnUrl,
        });
    });
});
