export type StripeAltPaymentMethod = 'cashapp' | 'affirm' | 'afterpay_clearpay' | 'klarna';

const stripeAltPaymentMethods: ReadonlySet<string> = new Set<StripeAltPaymentMethod>(['cashapp', 'affirm', 'afterpay_clearpay', 'klarna']);

export function isStripeAltPaymentMethod(method: string): method is StripeAltPaymentMethod {
    return stripeAltPaymentMethods.has(method);
}

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
    returnUrl: string;
};

type StripeAltConfirmationResult = {
    error?: { message?: string };
    paymentIntent?: { status?: string };
};

export type StripeAltConfirmers = {
    confirmAffirmPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmAfterpayClearpayPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
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

// No `shipping` here on purpose: the server already set it on the PaymentIntent
// with the secret key, and Stripe rejects changing it from a publishable key
// ("The shipping information on this PaymentIntent was last set with a secret
// key and therefore cannot be changed with a publishable key").
export function buildAffirmPaymentData({ email, billing, returnUrl }: AffirmConfirmationInput) {
    return {
        payment_method: {
            billing_details: {
                email,
                name: `${billing.first_name} ${billing.last_name}`.trim(),
                address: mapStripeAddress(billing),
            },
        },
        return_url: returnUrl,
    };
}

// Same reasoning as Affirm: the server already set `shipping` on the PaymentIntent, so only
// the billing details travel from the client.
export function buildAfterpayClearpayPaymentData(input: AffirmConfirmationInput) {
    return buildAffirmPaymentData(input);
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
    if (method === 'afterpay_clearpay') {
        return stripe.confirmAfterpayClearpayPayment(clientSecret, data);
    }
    if (method === 'klarna') {
        return stripe.confirmKlarnaPayment(clientSecret, data);
    }
    return stripe.confirmCashappPayment(clientSecret, data);
}
