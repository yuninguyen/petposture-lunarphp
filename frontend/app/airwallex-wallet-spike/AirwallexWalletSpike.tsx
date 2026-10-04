'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

type SpikeElement = {
    on: (event: string, handler: (event?: { detail?: unknown }) => void) => void;
    mount: (id: string) => void;
};

type SpikeSdk = {
    init: (options: { env: string; enabledElements: string[] }) => Promise<unknown>;
    createElement: (type: string, options: Record<string, unknown>) => Promise<SpikeElement | null>;
};

const MERCHANT_ID = 'acct_ONfkTFRFM8i5yvA-i-zAcQ';

function loadSdk(): Promise<SpikeSdk> {
    const existing = (window as unknown as { AirwallexComponentsSDK?: SpikeSdk }).AirwallexComponentsSDK;
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://static.airwallex.com/components/sdk/v1/index.js';
        script.addEventListener('load', () => resolve((window as unknown as { AirwallexComponentsSDK: SpikeSdk }).AirwallexComponentsSDK), { once: true });
        script.addEventListener('error', () => reject(new Error('SDK failed to load')), { once: true });
        document.head.appendChild(script);
    });
}

export default function AirwallexWalletSpike() {
    const [lines, setLines] = useState<string[]>(['starting...']);
    const [intentId, setIntentId] = useState<string | null>(null);

    const fetchIntent = async (id: string) => {
        const result = await (await fetchApi(`/api/checkout/airwallex-wallet-spike/${id}`)).json();
        setLines((previous) => [...previous, `INTENT NOW: ${JSON.stringify(result, null, 2)}`]);
    };

    useEffect(() => {
        let cancelled = false;
        const log = (label: string, value: unknown) =>
            setLines((previous) => [...previous, `${label}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`]);

        // element.on() never fires for Airwallex's iframes; whatever they tell the page arrives as window messages.
        const onMessage = (event: MessageEvent) => {
            if (!/airwallex\.com$/.test(new URL(event.origin).hostname)) return;
            log('message', event.data);
        };
        window.addEventListener('message', onMessage);

        (async () => {
            try {
                const created = await (await fetchApi('/api/checkout/airwallex-wallet-spike', { method: 'POST', body: {} })).json();
                const intent = created.intent;
                setIntentId(intent.intent_id);
                log('intent', { intent_id: intent.intent_id, env: intent.env, mode: intent.mode });
                const sdk = await loadSdk();
                await sdk.init({ env: intent.env, enabledElements: ['payments'] });
                const element = await sdk.createElement('googlePayButton', {
                    intent_id: intent.intent_id,
                    client_secret: intent.client_secret,
                    amount: { value: 5, currency: 'USD' },
                    countryCode: 'US',
                    gatewayMerchantId: MERCHANT_ID,
                    emailRequired: true,
                    shippingAddressRequired: true,
                    shippingAddressParameters: { phoneNumberRequired: true, format: 'FULL', allowedCountryCodes: ['US'] },
                    billingAddressRequired: true,
                    billingAddressParameters: { format: 'FULL', phoneNumberRequired: true },
                    authFormContainer: 'spike-auth',
                    buttonType: 'plain',
                    buttonColor: 'black',
                });
                if (!element || cancelled) return;
                // Registered AFTER mount: handlers set before it never fired in earlier runs.
                element.mount('spike-google-pay');
                ['ready', 'cancel', 'error', 'success', 'authorized', 'shippingMethodChange', 'shippingAddressChange', 'click'].forEach((name) => {
                    element.on(name, (event) => log(`event ${name}`, event?.detail ?? ''));
                });
                log('on() registered', typeof element.on);
            } catch (error) {
                log('ERROR', error instanceof Error ? error.message : String(error));
            }
        })();

        return () => {
            cancelled = true;
            window.removeEventListener('message', onMessage);
        };
    }, []);

    return (
        <main className="mx-auto max-w-xl p-4">
            <h1 className="text-lg font-semibold">Airwallex Google Pay spike ($5.00 sandbox)</h1>
            <p className="text-sm">Throwaway page: tap the button, pay with a Google Pay test card, then read what Airwallex returns.</p>
            <div id="spike-google-pay" className="my-4 min-h-12" />
            <div id="spike-auth" />
            <button type="button" disabled={!intentId} onClick={() => intentId && fetchIntent(intentId)} className="mb-3 rounded border px-3 py-1 text-sm">
                Fetch intent now
            </button>
            <pre className="overflow-auto bg-gray-100 p-3 text-xs">{lines.join('\n\n')}</pre>
        </main>
    );
}
