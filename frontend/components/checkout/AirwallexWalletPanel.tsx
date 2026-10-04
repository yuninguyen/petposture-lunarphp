'use client';

import { useEffect, useRef, useState } from 'react';
import { mountAirwallexWallet, type AirwallexWallet } from './airwallexCheckout';

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

export interface AirwallexWalletPanelProps {
    wallet: AirwallexWallet;
    env: string;
    // Google Pay only: our Airwallex account id.
    merchantId?: string;
    // The contact and shipping details are filled in: the intent is priced from them.
    ready: boolean;
    // Changes whenever what is bought, where it ships or what it costs changes: a new intent is needed then.
    attemptKey: string;
    prepareSession: () => Promise<AirwallexWalletSession>;
    placeOrder: (context: { intent_id: string; session_id: string; wallet: AirwallexWallet }) => Promise<AirwallexWalletOrder>;
    onPaid: (session: AirwallexWalletSession, order: AirwallexWalletOrder) => void;
}

const LABELS: Record<AirwallexWallet, string> = { google_pay: 'Google Pay', apple_pay: 'Apple Pay' };
// Typing an address changes the key on every keystroke; wait for it to settle before opening an intent.
const SETTLE_MS = 350;

type Status = 'idle' | 'preparing' | 'ready' | 'error';

// Airwallex's Google Pay / Apple Pay button pays the PaymentIntent it is given the moment it is tapped, and the
// Google Pay sheet gives us no shipping address, so (unlike Stripe's express buttons) it lives inside the form:
// the intent is opened from the address the shopper has already typed, and the order is created on the tap,
// before the payment is sent.
export function AirwallexWalletPanel({ wallet, env, merchantId, ready, attemptKey, prepareSession, placeOrder, onPaid }: AirwallexWalletPanelProps) {
    const label = LABELS[wallet];
    const buttonId = `airwallex-${wallet.replace('_', '-')}-button`;
    const authFormId = `airwallex-${wallet.replace('_', '-')}-3ds`;
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
        const container = document.getElementById(buttonId);

        const timer = window.setTimeout(async () => {
            setStatus('preparing');
            setMessage(null);

            try {
                const session = await prepareRef.current();
                if (cancelled) return;

                if (session.mode === 'placeholder' || !session.amount) {
                    throw new Error(`${label} is not available right now. Please choose another payment method.`);
                }

                // One order per intent: a second tap (after cancelling the sheet) reuses it; a failed one is retried.
                let orderPromise: Promise<AirwallexWalletOrder> | null = null;
                const orderFor = () => {
                    orderPromise ??= placeOrderRef.current({ intent_id: session.intent_id, session_id: session.session_id, wallet });
                    orderPromise.catch(() => { orderPromise = null; });
                    return orderPromise;
                };

                const mounted = await mountAirwallexWallet(env, wallet, buttonId, {
                    merchantId,
                    intentId: session.intent_id,
                    clientSecret: session.client_secret,
                    amountMinor: session.amount,
                    currency: session.currency ?? 'usd',
                    authFormContainer: authFormId,
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
                setMessage(error instanceof Error ? error.message : `${label} could not be loaded. Please try again.`);
            }
        }, SETTLE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            button?.destroy();
            if (container) container.innerHTML = '';
        };
    }, [wallet, env, merchantId, ready, attemptKey, buttonId, authFormId, label]);

    return (
        <div className="grid gap-3">
            {!ready ? (
                <p className="text-sm leading-[1.45] text-[#6f7782]">Enter your contact and shipping details above, then pay with {label} here.</p>
            ) : null}
            <div className={ready ? 'relative' : 'hidden'}>
                <div id={buttonId} className="min-h-[49px] w-full" />
                {/* A dimmed stand-in for the button while the intent and the Airwallex iframe load, so the spot is not empty. */}
                {status !== 'ready' && status !== 'error' ? (
                    <div role="status" aria-label={`Loading ${label}`} className="pointer-events-none absolute inset-0 animate-pulse rounded-[3px] bg-[#202124]/70" />
                ) : null}
            </div>
            <div id={authFormId} className="empty:hidden" />
            {message ? <p role="alert" className="text-sm font-medium text-[#b42318]">{message}</p> : null}
        </div>
    );
}
