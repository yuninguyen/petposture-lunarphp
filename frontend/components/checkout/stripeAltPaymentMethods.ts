export type StripeAltPaymentMethod = 'cashapp' | 'affirm' | 'afterpay_clearpay' | 'klarna' | 'amazon_pay' | 'ach_debit';

const stripeAltPaymentMethods: ReadonlySet<string> = new Set<StripeAltPaymentMethod>(['cashapp', 'affirm', 'afterpay_clearpay', 'klarna', 'amazon_pay', 'ach_debit']);

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
    // Amazon Pay has no method-specific confirm function; it goes through confirmPayment with the client secret.
    confirmPayment: (options: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmKlarnaPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmCashappPayment: (clientSecret: string, data: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    // ACH is two calls: collectBankAccountForPayment opens Stripe's Financial Connections modal (bank
    // login) inside the page and attaches the account, then confirmUsBankAccountPayment submits it.
    collectBankAccountForPayment: (options: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
    confirmUsBankAccountPayment: (clientSecret: string, data?: Record<string, unknown>) => Promise<StripeAltConfirmationResult>;
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

// confirmParams for stripe.confirmPayment({ clientSecret, confirmParams }).
export function buildAmazonPayPaymentData(returnUrl: string) {
    return {
        payment_method_data: { type: 'amazon_pay' },
        return_url: returnUrl,
    };
}

// `params` for stripe.collectBankAccountForPayment. Shipping is already on the PaymentIntent
// (server-side); the bank account itself is collected by Stripe's modal, so only the account
// holder's name and email travel from here.
export function buildAchDebitPaymentData({ email, name }: { email: string; name: string }) {
    return {
        payment_method_type: 'us_bank_account',
        payment_method_data: {
            billing_details: { name, email },
        },
    };
}

async function confirmAchDebitPayment(stripe: StripeAltConfirmers, clientSecret: string, params: Record<string, unknown>) {
    const collected = await stripe.collectBankAccountForPayment({ clientSecret, params });
    if (collected.error) {
        return collected;
    }
    // Closing the modal (or not finishing the bank login) leaves the intent without a bank account.
    if (collected.paymentIntent?.status !== 'requires_confirmation') {
        return { error: { message: 'No bank account was linked.' } } satisfies StripeAltConfirmationResult;
    }
    return stripe.confirmUsBankAccountPayment(clientSecret);
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
    if (method === 'amazon_pay') {
        return stripe.confirmPayment({ clientSecret, confirmParams: data });
    }
    if (method === 'ach_debit') {
        return confirmAchDebitPayment(stripe, clientSecret, data);
    }
    if (method === 'klarna') {
        return stripe.confirmKlarnaPayment(clientSecret, data);
    }
    return stripe.confirmCashappPayment(clientSecret, data);
}
