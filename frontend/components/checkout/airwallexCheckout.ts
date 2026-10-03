const airwallexSdkScriptId = 'petposture-airwallex-sdk';
const airwallexSdkUrl = 'https://static.airwallex.com/components/sdk/v1/index.js';

type AirwallexPayments = {
    redirectToCheckout: (options: Record<string, unknown>) => void;
};

declare global {
    interface Window {
        AirwallexComponentsSDK?: {
            init: (options: { env: string; enabledElements: string[] }) => Promise<{ payments?: AirwallexPayments }>;
        };
    }
}

export type AirwallexCheckoutSession = {
    env: string;
    intent_id: string;
    client_secret: string;
    currency: string;
    return_url: string;
};

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

// Sends the whole window to Airwallex's hosted payment page; the shopper comes back to return_url.
export async function redirectToAirwallexCheckout(session: AirwallexCheckoutSession): Promise<void> {
    await loadAirwallexSdk();

    const sdk = window.AirwallexComponentsSDK;
    if (!sdk) throw new Error('Airwallex could not be loaded. Please try again.');

    const { payments } = await sdk.init({ env: session.env, enabledElements: ['payments'] });
    if (!payments) throw new Error('Airwallex could not be started. Please try again.');

    payments.redirectToCheckout({
        env: session.env,
        mode: 'payment',
        intent_id: session.intent_id,
        client_secret: session.client_secret,
        currency: session.currency,
        successUrl: session.return_url,
    });
}
