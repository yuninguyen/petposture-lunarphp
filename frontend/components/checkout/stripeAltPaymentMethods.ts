export type StripeAltPaymentMethod = 'cashapp' | 'affirm' | 'klarna';

type StripeAltPaymentMethodOption = {
    method: StripeAltPaymentMethod;
    enabled: boolean;
    min_amount_minor?: number | null;
    max_amount_minor?: number | null;
};

export function isStripeAltPaymentMethodEligible(
    method: StripeAltPaymentMethodOption,
    amountMinor: number,
): boolean {
    return method.enabled
        && (method.min_amount_minor == null || amountMinor >= method.min_amount_minor)
        && (method.max_amount_minor == null || amountMinor <= method.max_amount_minor);
}
