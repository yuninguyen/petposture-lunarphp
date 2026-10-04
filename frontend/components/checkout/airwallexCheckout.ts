const airwallexSdkScriptId = 'petposture-airwallex-sdk';
const airwallexSdkUrl = 'https://static.airwallex.com/components/sdk/v1/index.js';

type AirwallexIntent = { id?: string; status?: string };

type AirwallexElement = {
    mount: (containerId: string) => unknown;
    destroy?: () => void;
    confirm?: (data: { intent_id: string; client_secret: string; payment_method?: Record<string, unknown> }) => Promise<AirwallexIntent>;
    on?: (event: string, handler: (event?: { detail?: { error?: { message?: string } } }) => void) => void;
};

declare global {
    interface Window {
        AirwallexComponentsSDK?: {
            init: (options: { env: string; enabledElements: string[] }) => Promise<unknown>;
            createElement: (type: string, options?: Record<string, unknown>) => Promise<AirwallexElement | null>;
        };
    }
}

export type AirwallexCardFields = {
    cardNumber: AirwallexElement;
    destroy: () => void;
};

export type AirwallexCardContainers = {
    cardNumber: string;
    expiry: string;
    cvc: string;
    // Where Airwallex shows its 3D Secure challenge, when the bank asks for one.
    authForm: string;
};

const sdkReady: Record<string, Promise<void>> = {};

function loadAirwallexSdk(): Promise<void> {
    if (window.AirwallexComponentsSDK) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existing = document.getElementById(airwallexSdkScriptId) as HTMLScriptElement | null;
        const script = existing ?? document.createElement('script');
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Airwallex could not be loaded. Please try again.')), { once: true });

        if (!existing) {
            script.id = airwallexSdkScriptId;
            script.async = true;
            script.src = airwallexSdkUrl;
            document.head.appendChild(script);
        }
    });
}

function initAirwallexSdk(env: string): Promise<void> {
    sdkReady[env] ??= loadAirwallexSdk().then(async () => {
        const sdk = window.AirwallexComponentsSDK;
        if (!sdk) throw new Error('Airwallex could not be loaded. Please try again.');
        await sdk.init({ env, enabledElements: ['payments'] });
    });

    return sdkReady[env].catch((error) => {
        // Let the next attempt retry instead of caching the failure.
        delete sdkReady[env];
        throw error;
    });
}

// Starts loading and initialising Airwallex.js in the background, so a button mounted later does not wait for it.
export function preloadAirwallexSdk(env: string): void {
    initAirwallexSdk(env).catch(() => undefined);
}

// Split card fields (number, expiry, CVC) rendered by Airwallex inside our own checkout page. The
// PaymentIntent does not exist yet at this point; its id and secret are passed to confirm() later.
export type AirwallexCardNumberState = { empty: boolean; brand: string };

// The card number iframe tells the page about every change by posting {type:'cardNumber', code:'onChange',
// empty, brand, ...} to the parent window (the SDK's own element.on() never fired in testing), so the
// page listens for those messages from Airwallex's origin.
function listenForCardNumberState(onState: (state: AirwallexCardNumberState) => void): () => void {
    const handler = (event: MessageEvent) => {
        if (!/^https:\/\/[a-z0-9.-]+\.airwallex\.com$/i.test(event.origin)) return;

        let data: unknown = event.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                return;
            }
        }

        const message = data as { type?: string; code?: string; empty?: boolean; brand?: string } | null;
        if (message?.type === 'cardNumber' && typeof message.empty === 'boolean') {
            onState({ empty: message.empty, brand: message.brand ?? 'default' });
        }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}

export async function mountAirwallexCardFields(
    env: string,
    containers: AirwallexCardContainers,
    onCardNumberState?: (state: AirwallexCardNumberState) => void,
): Promise<AirwallexCardFields> {
    await initAirwallexSdk(env);

    const sdk = window.AirwallexComponentsSDK;
    if (!sdk) throw new Error('Airwallex could not be loaded. Please try again.');

    // Same look as the Stripe card fields: our own bordered box around each field, text in the page's
    // font size/colour with the same placeholders.
    const style = { base: { fontSize: '14px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } } };
    const cardNumber = await sdk.createElement('cardNumber', {
        authFormContainer: containers.authForm,
        allowedCardNetworks: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay'],
        placeholder: 'Card number',
        style,
    });
    const expiry = await sdk.createElement('expiry', { placeholder: 'Expiration date (MM / YY)', style });
    const cvc = await sdk.createElement('cvc', { placeholder: 'Security code', style });

    if (!cardNumber || !expiry || !cvc) {
        throw new Error('The card form could not be started. Please try again.');
    }

    const stopListening = onCardNumberState ? listenForCardNumberState(onCardNumberState) : () => undefined;

    cardNumber.mount(containers.cardNumber);
    expiry.mount(containers.expiry);
    cvc.mount(containers.cvc);

    return {
        cardNumber,
        destroy: () => {
            stopListening();
            for (const element of [cardNumber, expiry, cvc]) element.destroy?.();
        },
    };
}

export type AirwallexWallet = 'google_pay' | 'apple_pay';

export type AirwallexWalletOptions = {
    // Google Pay only: our Airwallex account id (gatewayMerchantId). Apple Pay on the web needs none.
    merchantId?: string;
    intentId: string;
    clientSecret: string;
    // The PaymentIntent's amount in minor units and its currency; the wallet sheet shows it.
    amountMinor: number;
    currency: string;
    authFormContainer: string;
    // Fires when the shopper taps the button, before the payment is sent: the order is created here.
    onClick: () => void;
    onSuccess: () => void;
    onCancel: () => void;
    onError: (message: string) => void;
};

const walletLabels: Record<AirwallexWallet, string> = { google_pay: 'Google Pay', apple_pay: 'Apple Pay' };

// Same size and corners as the "Complete order" button these buttons stand in for.
const walletButtonStyle = { height: '49px', borderRadius: '3px' };

function walletElementOptions(wallet: AirwallexWallet, options: AirwallexWalletOptions): Record<string, unknown> {
    const common = {
        intent_id: options.intentId,
        client_secret: options.clientSecret,
        amount: { value: options.amountMinor / 100, currency: options.currency.toUpperCase() },
        countryCode: 'US',
        buttonType: 'plain',
        buttonColor: 'black',
    };

    if (wallet === 'apple_pay') {
        // Airwallex validates the merchant with Apple itself (its own certificates) for the web, so the
        // validateMerchant step is not ours. The shipping address comes from our own form, not from the sheet.
        return {
            ...common,
            totalPriceLabel: 'PetPosture',
            requiredBillingContactFields: ['postalAddress'],
            appearance: { rules: { '.ApplePayButton': walletButtonStyle } },
        };
    }

    return {
        ...common,
        gatewayMerchantId: options.merchantId,
        billingAddressRequired: true,
        billingAddressParameters: { format: 'FULL' },
        authFormContainer: options.authFormContainer,
        buttonSizeMode: 'fill',
        appearance: { rules: { '.GooglePayButton': walletButtonStyle } },
    };
}

// Airwallex's own Google Pay / Apple Pay button. Tapping it pays the PaymentIntent given here straight away, so
// the intent has to exist (with the right amount) before the button is mounted. Its events are only delivered
// when they are registered AFTER mount().
export async function mountAirwallexWallet(env: string, wallet: AirwallexWallet, containerId: string, options: AirwallexWalletOptions): Promise<{ destroy: () => void }> {
    await initAirwallexSdk(env);

    const sdk = window.AirwallexComponentsSDK;
    if (!sdk) throw new Error('Airwallex could not be loaded. Please try again.');

    const label = walletLabels[wallet];
    const element = await sdk.createElement(wallet === 'apple_pay' ? 'applePayButton' : 'googlePayButton', walletElementOptions(wallet, options));

    if (!element) throw new Error(`${label} could not be started. Please try again.`);

    element.mount(containerId);
    element.on?.('click', () => options.onClick());
    element.on?.('success', () => options.onSuccess());
    element.on?.('cancel', () => options.onCancel());
    element.on?.('error', (event) => options.onError(event?.detail?.error?.message || `${label} could not complete the payment. Please try again.`));

    return { destroy: () => element.destroy?.() };
}

const acceptedStatuses = new Set(['SUCCEEDED', 'REQUIRES_CAPTURE']);

export type AirwallexCardholder = {
    name: string;
    email: string;
    phone?: string;
    billing: { first_name: string; last_name: string; line_one: string; line_two?: string | null; city: string; state: string; postcode: string; country: string };
};

// Cardholder name and billing details, the counterpart of Stripe's billing_details. The card itself is
// added by the SDK from the three fields.
function paymentMethodFor(cardholder: AirwallexCardholder) {
    const { billing } = cardholder;
    const country = billing.country.trim().toLowerCase() === 'united states' ? 'US' : billing.country.trim().slice(0, 2).toUpperCase();

    return {
        card: { name: cardholder.name },
        billing: {
            first_name: billing.first_name,
            last_name: billing.last_name,
            email: cardholder.email,
            ...(cardholder.phone ? { phone_number: cardholder.phone } : {}),
            address: {
                country_code: country,
                state: billing.state,
                city: billing.city,
                street: [billing.line_one, billing.line_two].filter(Boolean).join(' '),
                postcode: billing.postcode,
            },
        },
    };
}

// Resolves with the final PaymentIntent status; throws a readable error when the card is declined or
// the authentication fails. The order is only ever marked paid by Airwallex's webhook, never by this.
export async function confirmAirwallexCardPayment(
    fields: AirwallexCardFields,
    payment: { intent_id: string; client_secret: string },
    cardholder?: AirwallexCardholder,
): Promise<string> {
    if (!fields.cardNumber.confirm) {
        throw new Error('The card form is not ready yet. Please try again.');
    }

    let intent: AirwallexIntent;
    try {
        intent = await fields.cardNumber.confirm(cardholder ? { ...payment, payment_method: paymentMethodFor(cardholder) } : payment);
    } catch (error) {
        const message = (error as { message?: string } | null)?.message;
        throw new Error(message || 'Your card could not be processed. Please check the details or try another card.');
    }

    const status = intent?.status ?? '';
    if (!acceptedStatuses.has(status)) {
        throw new Error('Your card could not be processed. Please check the details or try another card.');
    }

    return status;
}
