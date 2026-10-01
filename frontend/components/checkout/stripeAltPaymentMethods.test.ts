import { describe, expect, it } from 'vitest';
import { isStripeAltPaymentMethodEligible } from './stripeAltPaymentMethods';

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
});
