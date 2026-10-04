// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAirwallexCardPayment, mountAirwallexCardFields, mountAirwallexWallet } from './airwallexCheckout';

const containers = { cardNumber: 'awx-card-number', expiry: 'awx-expiry', cvc: 'awx-cvc', authForm: 'awx-3ds' };

function installSdk(elements: Record<string, unknown>) {
    const init = vi.fn().mockResolvedValue(undefined);
    const createElement = vi.fn().mockImplementation(async (type: string) => elements[type] ?? null);
    window.AirwallexComponentsSDK = { init, createElement };
    return { init, createElement };
}

afterEach(() => {
    delete window.AirwallexComponentsSDK;
    document.getElementById('petposture-airwallex-sdk')?.remove();
});

describe('mountAirwallexCardFields', () => {
    it('creates and mounts the three split card elements, pointing 3D Secure at its own container', async () => {
        const cardNumber = { mount: vi.fn(), destroy: vi.fn(), confirm: vi.fn() };
        const expiry = { mount: vi.fn(), destroy: vi.fn() };
        const cvc = { mount: vi.fn(), destroy: vi.fn() };
        const { init, createElement } = installSdk({ cardNumber, expiry, cvc });

        const fields = await mountAirwallexCardFields('demo-mount', containers);

        expect(init).toHaveBeenCalledWith({ env: 'demo-mount', enabledElements: ['payments'] });
        expect(createElement).toHaveBeenCalledWith('cardNumber', expect.objectContaining({ authFormContainer: 'awx-3ds' }));
        expect(cardNumber.mount).toHaveBeenCalledWith('awx-card-number');
        expect(expiry.mount).toHaveBeenCalledWith('awx-expiry');
        expect(cvc.mount).toHaveBeenCalledWith('awx-cvc');

        fields.destroy();
        expect(cardNumber.destroy).toHaveBeenCalled();
        expect(expiry.destroy).toHaveBeenCalled();
        expect(cvc.destroy).toHaveBeenCalled();
    });

    it('reports empty/brand from the card number iframe messages and ignores other origins', async () => {
        installSdk({ cardNumber: { mount: vi.fn(), destroy: vi.fn() }, expiry: { mount: vi.fn() }, cvc: { mount: vi.fn() } });
        const onState = vi.fn();

        const fields = await mountAirwallexCardFields('demo-state', containers, onState);
        const post = (origin: string, data: unknown) => window.dispatchEvent(new MessageEvent('message', { origin, data }));
        post('https://checkout-demo.airwallex.com', { type: 'cardNumber', code: 'onChange', empty: false, brand: 'mastercard' });
        post('https://checkout-demo.airwallex.com', JSON.stringify({ type: 'cardNumber', code: 'onChange', empty: true, brand: 'default' }));
        post('https://checkout-demo.airwallex.com', { type: 'cvc', code: 'onReady' });
        post('https://evil.example.com', { type: 'cardNumber', code: 'onChange', empty: false, brand: 'visa' });

        expect(onState.mock.calls).toEqual([[{ empty: false, brand: 'mastercard' }], [{ empty: true, brand: 'default' }]]);

        fields.destroy();
        post('https://checkout-demo.airwallex.com', { type: 'cardNumber', code: 'onChange', empty: false, brand: 'visa' });
        expect(onState).toHaveBeenCalledTimes(2);
    });

    it('fails with a readable message when Airwallex does not create an element', async () => {
        installSdk({ cardNumber: { mount: vi.fn() }, expiry: null, cvc: { mount: vi.fn() } });

        await expect(mountAirwallexCardFields('demo-fail', containers)).rejects.toThrow('card form could not be started');
    });
});

describe('mountAirwallexWallet', () => {
    const handlers = () => ({ onClick: vi.fn(), onSuccess: vi.fn(), onCancel: vi.fn(), onError: vi.fn() });
    const base = { merchantId: 'acct_1', intentId: 'int_1', clientSecret: 'secret_1', amountMinor: 4599, currency: 'usd', authFormContainer: 'awx-3ds' };

    it('creates the button for the intent in major units and registers its events only after mount', async () => {
        const calls: string[] = [];
        const listeners: Record<string, (event?: unknown) => void> = {};
        const element = {
            mount: vi.fn(() => calls.push('mount')),
            destroy: vi.fn(),
            on: vi.fn((name: string, handler: (event?: unknown) => void) => { calls.push(`on:${name}`); listeners[name] = handler; }),
        };
        const { createElement } = installSdk({ googlePayButton: element });
        const events = handlers();

        const button = await mountAirwallexWallet('demo-gp', 'google_pay', 'awx-google-pay', { ...base, ...events });

        expect(createElement).toHaveBeenCalledWith('googlePayButton', expect.objectContaining({
            intent_id: 'int_1',
            client_secret: 'secret_1',
            amount: { value: 45.99, currency: 'USD' },
            countryCode: 'US',
            gatewayMerchantId: 'acct_1',
            authFormContainer: 'awx-3ds',
        }));
        expect(element.mount).toHaveBeenCalledWith('awx-google-pay');
        // Events set before mount() never fire in Airwallex's SDK.
        expect(calls[0]).toBe('mount');

        listeners.click();
        listeners.success();
        listeners.cancel();
        listeners.error({ detail: { error: { message: 'Declined' } } });
        listeners.error();
        expect(events.onClick).toHaveBeenCalledTimes(1);
        expect(events.onSuccess).toHaveBeenCalledTimes(1);
        expect(events.onCancel).toHaveBeenCalledTimes(1);
        expect(events.onError.mock.calls[0]).toEqual(['Declined']);
        expect(events.onError.mock.calls[1][0]).toContain('Google Pay could not complete');

        button.destroy();
        expect(element.destroy).toHaveBeenCalled();
    });

    it('fails with a readable message when Airwallex does not create the button', async () => {
        installSdk({ googlePayButton: null });

        await expect(mountAirwallexWallet('demo-gp-fail', 'google_pay', 'awx-google-pay', { ...base, ...handlers() })).rejects.toThrow('Google Pay could not be started');
    });

    it('creates an Apple Pay button without a merchant id, asking only for the billing postal address', async () => {
        const listeners: Record<string, (event?: unknown) => void> = {};
        const element = {
            mount: vi.fn(),
            destroy: vi.fn(),
            on: vi.fn((name: string, handler: (event?: unknown) => void) => { listeners[name] = handler; }),
        };
        const { createElement } = installSdk({ applePayButton: element });
        const events = handlers();

        await mountAirwallexWallet('demo-ap', 'apple_pay', 'awx-apple-pay', { ...base, merchantId: undefined, ...events });

        const options = createElement.mock.calls[0][1] as Record<string, unknown>;
        expect(createElement.mock.calls[0][0]).toBe('applePayButton');
        expect(options).toMatchObject({ intent_id: 'int_1', amount: { value: 45.99, currency: 'USD' }, countryCode: 'US', requiredBillingContactFields: ['postalAddress'] });
        expect(options).not.toHaveProperty('gatewayMerchantId');
        expect(element.mount).toHaveBeenCalledWith('awx-apple-pay');

        listeners.click();
        listeners.error();
        expect(events.onClick).toHaveBeenCalledTimes(1);
        expect(events.onError.mock.calls[0][0]).toContain('Apple Pay could not complete');
    });
});

describe('confirmAirwallexCardPayment', () => {
    const payment = { intent_id: 'int_1', client_secret: 'secret_1' };
    const fieldsWith = (confirm: unknown) => ({ cardNumber: { mount: vi.fn(), confirm } as never, destroy: vi.fn() });

    it('confirms the intent through the card number element and returns the status', async () => {
        const confirm = vi.fn().mockResolvedValue({ id: 'int_1', status: 'SUCCEEDED' });

        await expect(confirmAirwallexCardPayment(fieldsWith(confirm), payment)).resolves.toBe('SUCCEEDED');
        expect(confirm).toHaveBeenCalledWith(payment);
    });

    it('sends the cardholder name and billing details the way Stripe gets billing_details', async () => {
        const confirm = vi.fn().mockResolvedValue({ id: 'int_1', status: 'SUCCEEDED' });

        await confirmAirwallexCardPayment(fieldsWith(confirm), payment, {
            name: 'Jane Q Doe',
            email: 'jane@example.com',
            phone: '5125550100',
            billing: { first_name: 'Jane', last_name: 'Doe', line_one: '1 Main St', line_two: 'Apt 2', city: 'Austin', state: 'TX', postcode: '78701', country: 'United States' },
        });

        expect(confirm).toHaveBeenCalledWith({
            ...payment,
            payment_method: {
                card: { name: 'Jane Q Doe' },
                billing: {
                    first_name: 'Jane',
                    last_name: 'Doe',
                    email: 'jane@example.com',
                    phone_number: '5125550100',
                    address: { country_code: 'US', state: 'TX', city: 'Austin', street: '1 Main St Apt 2', postcode: '78701' },
                },
            },
        });
    });

    it('surfaces the decline message from Airwallex', async () => {
        const confirm = vi.fn().mockRejectedValue({ code: 'card_declined', message: 'Your card was declined.' });

        await expect(confirmAirwallexCardPayment(fieldsWith(confirm), payment)).rejects.toThrow('Your card was declined.');
    });

    it('treats an intent that is not paid or authorised as a failure', async () => {
        const confirm = vi.fn().mockResolvedValue({ id: 'int_1', status: 'REQUIRES_PAYMENT_METHOD' });

        await expect(confirmAirwallexCardPayment(fieldsWith(confirm), payment)).rejects.toThrow('could not be processed');
    });
});
