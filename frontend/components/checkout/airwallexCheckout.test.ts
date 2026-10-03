// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirectToAirwallexCheckout } from './airwallexCheckout';

afterEach(() => {
    delete window.AirwallexComponentsSDK;
    document.getElementById('petposture-airwallex-sdk')?.remove();
});

describe('redirectToAirwallexCheckout', () => {
    const session = {
        env: 'demo',
        intent_id: 'int_1',
        client_secret: 'secret_1',
        currency: 'USD',
        return_url: 'https://shop.example/checkout/success?gateway=airwallex&session_id=AIRWALLEX-1',
    };

    it('initialises the payments element for the environment and redirects with the intent and return URL', async () => {
        const redirectToCheckout = vi.fn();
        const init = vi.fn().mockResolvedValue({ payments: { redirectToCheckout } });
        window.AirwallexComponentsSDK = { init };

        await redirectToAirwallexCheckout(session);

        expect(init).toHaveBeenCalledWith({ env: 'demo', enabledElements: ['payments'] });
        expect(redirectToCheckout).toHaveBeenCalledWith({
            env: 'demo',
            mode: 'payment',
            intent_id: 'int_1',
            client_secret: 'secret_1',
            currency: 'USD',
            successUrl: session.return_url,
        });
    });

    it('fails with a readable message when the SDK does not provide the payments element', async () => {
        window.AirwallexComponentsSDK = { init: vi.fn().mockResolvedValue({}) };

        await expect(redirectToAirwallexCheckout(session)).rejects.toThrow('Airwallex could not be started');
    });
});
