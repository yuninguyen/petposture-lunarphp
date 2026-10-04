'use client';

import { useEffect, useRef, useState } from 'react';
import { mountAirwallexGooglePay } from './airwallexCheckout';

export type AirwallexWalletSession = {
    client_secret: string;
    intent_id: string;
    session_id: string;
    return_url: string;
    mode: string;
    // The PaymentIntent's amount in minor units, as the backend priced the cart.
    amount?: number;
    currency?: string;
};

export type AirwallexWalletOrder = { reference: string; trackingToken: string };

export interface AirwallexGooglePayPanelProps {
    env: string;
    merchantId: string;
    // The contact and shipping details are filled in: the intent is priced from them.
    ready: boolean;
    // Changes whenever what is bought, where it ships or what it costs changes: a new intent is needed then.
    attemptKey: string;
    prepareSession: () => Promise<AirwallexWalletSession>;
    placeOrder: (context: { intent_id: string; session_id: string; wallet: 'google_pay' }) => Promise<AirwallexWalletOrder>;
    onPaid: (session: AirwallexWalletSession, order: AirwallexWalletOrder) => void;
}

const BUTTON_ID = 'airwallex-google-pay-button';
const AUTH_FORM_ID = 'airwallex-google-pay-3ds';
// Typing an address changes the key on every keystroke; wait for it to settle before opening an intent.
const SETTLE_MS = 700;

type Status = 'idle' | 'preparing' | 'ready' | 'error';

// Airwallex's Google Pay button pays the PaymentIntent it is given the moment it is tapped, and the sheet gives
// us no shipping address, so (unlike Stripe's express buttons) it lives inside the form: the intent is opened from
// the address the shopper has already typed, and the order is created on the tap, before the payment is sent.
export function AirwallexGooglePayPanel({ env, merchantId, ready, attemptKey, prepareSession, placeOrder, onPaid }: AirwallexGooglePayPanelProps) {
    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState<string | null>(null);

    // Read through refs so the mount effect only restarts when the cart, address or price really change.
    const prepareRef = useRef(prepareSession);
    const placeOrderRef = useRef(placeOrder);
    const onPaidRef = useRef(onPaid);
    useEffect(() => {
        prepareRef.current = prepareSession;
        placeOrderRef.current = placeOrder;
        onPaidRef.current = onPaid;
    }, [prepareSession, placeOrder, onPaid]);

    useEffect(() => {
        if (!ready) return;

        let cancelled = false;
        let button: { destroy: () => void } | null = null;
        const container = document.getElementById(BUTTON_ID);

        const timer = window.setTimeout(async () => {
            setStatus('preparing');
            setMessage(null);

            try {
                const session = await prepareRef.current();
                if (cancelled) return;

                if (session.mode === 'placeholder' || !session.amount) {
                    throw new Error('Google Pay is not available right now. Please choose another payment method.');
                }

                // One order per intent: a second tap (after cancelling the sheet) reuses it; a failed one is retried.
                let orderPromise: Promise<AirwallexWalletOrder> | null = null;
                const orderFor = () => {
                    orderPromise ??= placeOrderRef.current({ intent_id: session.intent_id, session_id: session.session_id, wallet: 'google_pay' });
                    orderPromise.catch(() => { orderPromise = null; });
                    return orderPromise;
                };

                const mounted = await mountAirwallexGooglePay(env, BUTTON_ID, {
                    merchantId,
                    intentId: session.intent_id,
                    clientSecret: session.client_secret,
                    amountMinor: session.amount,
                    currency: session.currency ?? 'usd',
                    authFormContainer: AUTH_FORM_ID,
                    onClick: () => {
                        setMessage(null);
                        // The sheet is already opening and Airwallex sends the payment as soon as it is confirmed:
                        // the order must exist by then, so it is created now.
                        void orderFor().catch((error) => setMessage(error instanceof Error ? error.message : 'Your order could not be created. Please try again.'));
                    },
                    onSuccess: () => {
                        orderFor().then(
                            (order) => onPaidRef.current(session, order),
                            () => setMessage('Your payment went through, but we could not save your order. Please contact us with your payment details before trying again.'),
                        );
                    },
                    onCancel: () => setMessage(null),
                    onError: (error) => setMessage(error),
                });

                if (cancelled) {
                    mounted.destroy();
                    return;
                }

                button = mounted;
                setStatus('ready');
            } catch (error) {
                if (cancelled) return;
                setStatus('error');
                setMessage(error instanceof Error ? error.message : 'Google Pay could not be loaded. Please try again.');
            }
        }, SETTLE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            button?.destroy();
            if (container) container.innerHTML = '';
        };
    }, [env, merchantId, ready, attemptKey]);

    return (
        <div className="grid gap-3">
            {!ready ? (
                <p className="text-sm leading-[1.45] text-[#6f7782]">Enter your contact and shipping details above, then pay with Google Pay here.</p>
            ) : status === 'preparing' || status === 'idle' ? (
                <p className="text-sm leading-[1.45] text-[#6f7782]" role="status">Loading Google Pay…</p>
            ) : null}
            <div id={BUTTON_ID} className={ready ? 'min-h-[48px] w-full' : 'hidden'} />
            <div id={AUTH_FORM_ID} className="empty:hidden" />
            {message ? <p role="alert" className="text-sm font-medium text-[#b42318]">{message}</p> : null}
        </div>
    );
}
