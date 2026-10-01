export type StripeAltPaymentMethod = 'cashapp' | 'affirm' | 'klarna';

type CheckoutAddress = {
    first_name: string;
    last_name: string;
    line_one: string;
    line_two?: string | null;
    city: string;
    state: string;
    postcode: string;
    country: string;
};

type AffirmConfirmationInput = {
    email: string;
    billing: CheckoutAddress;
    shipping: CheckoutAddress;
    returnUrl: string;
};

type StripeAltConfirmationResult = {
    error?: { message?: string };
    paymentIntent?: { status?: string };
};

export type StripeAltConfirmers = {
    confirmAffirmPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmKlarnaPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmCashappPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
};

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

function mapStripeAddress(address: CheckoutAddress) {
    return {
        line1: address.line_one,
        ...(address.line_two ? { line2: address.line_two } : {}),
        city: address.city,
        state: address.state,
        country: address.country.trim().toLowerCase() === 'united states' ? 'US' : address.country.trim().slice(0, 2).toUpperCase(),
        postal_code: address.postcode,
    };
}

export function buildAffirmPaymentData({ email, billing, shipping, returnUrl }: AffirmConfirmationInput) {
    return {
        payment_method: {
            billing_details: {
                email,
                name: `${billing.first_name} ${billing.last_name}`.trim(),
                address: mapStripeAddress(billing),
            },
        },
        shipping: {
            name: `${shipping.first_name} ${shipping.last_name}`.trim(),
            address: mapStripeAddress(shipping),
        },
        return_url: returnUrl,
    };
}

export function buildKlarnaPaymentData(returnUrl: string) {
    return { return_url: returnUrl };
}

export function buildCashAppPaymentData(returnUrl: string) {
    return {
        payment_method: { type: 'cashapp' },
        return_url: returnUrl,
    };
}

export function confirmStripeAltPayment(
    stripe: StripeAltConfirmers,
    method: StripeAltPaymentMethod,
    clientSecret: string,
    data: Record<string, unknown>,
) {
    if (method === 'affirm') {
        return stripe.confirmAffirmPayment(clientSecret, data);
    }
    if (method === 'klarna') {
        return stripe.confirmKlarnaPayment(clientSecret, data);
    }
    return stripe.confirmCashappPayment(clientSecret, data);
}
