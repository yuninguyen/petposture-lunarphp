// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAirwallexCardPayment, mountAirwallexCardFields } from './airwallexCheckout';

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

    it('fails with a readable message when Airwallex does not create an element', async () => {
        installSdk({ cardNumber: { mount: vi.fn() }, expiry: null, cvc: { mount: vi.fn() } });

        await expect(mountAirwallexCardFields('demo-fail', containers)).rejects.toThrow('card form could not be started');
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

    it('surfaces the decline message from Airwallex', async () => {
        const confirm = vi.fn().mockRejectedValue({ code: 'card_declined', message: 'Your card was declined.' });

        await expect(confirmAirwallexCardPayment(fieldsWith(confirm), payment)).rejects.toThrow('Your card was declined.');
    });

    it('treats an intent that is not paid or authorised as a failure', async () => {
        const confirm = vi.fn().mockResolvedValue({ id: 'int_1', status: 'REQUIRES_PAYMENT_METHOD' });

        await expect(confirmAirwallexCardPayment(fieldsWith(confirm), payment)).rejects.toThrow('could not be processed');
    });
});
