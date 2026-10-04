'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

type PayPalEligiblePaymentMethods = { isEligible: (method: string) => boolean };
type PayPalOnApproveData = { fundingSource: string; orderId: string; payerId?: string; billingToken?: string };
type PayPalOnShippingAddressChangeData = { orderId: string; shippingAddress: { city?: string; countryCode: string; postalCode?: string; state?: string } };
type PayPalErrorData = { message: string; code: string };

type PayPalOneTimePaymentSession = {
    start: (presentationModeOptions: { presentationMode: 'auto' }, paymentSessionPromise: Promise<{ orderId: string }>) => Promise<void>;
};

type PayPalSdkInstance = {
    findEligibleMethods: (options?: { currencyCode?: string }) => Promise<PayPalEligiblePaymentMethods>;
    createPayPalOneTimePaymentSession: (options: {
        commit?: boolean;
        onApprove?: (data: PayPalOnApproveData) => Promise<void>;
        onShippingAddressChange?: (data: PayPalOnShippingAddressChangeData) => Promise<void>;
        onError?: (data: PayPalErrorData) => void;
    }) => PayPalOneTimePaymentSession;
};

declare global {
    interface Window {
        paypal?: {
            createInstance: (options: { clientId: string; components: ['paypal-payments']; pageType?: string }) => Promise<PayPalSdkInstance>;
        };
    }
}

// PayPal's v6 Web SDK script sets window.paypal itself once loaded; there is
// no npm package involved here, matching how Shopify's own checkout loads it.
function loadPayPalSdk(environment: 'production' | 'sandbox'): Promise<void> {
    if (window.paypal) return Promise.resolve();
    const scriptId = 'paypal-v6-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
        return new Promise((resolve, reject) => {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load PayPal SDK')), { once: true });
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = scriptId;
        const host = environment === 'production' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
        script.src = `${host}/web-sdk/v6/core`;
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Failed to load PayPal SDK')), { once: true });
        document.head.appendChild(script);
    });
}

type StripeAddress = { line1?: string; line2?: string | null; city?: string; state?: string; postal_code?: string; country?: string };

type StripeElementsInstance = {
    elements: (options: Record<string, unknown>) => StripeElementsGroup;
    confirmPayment: (options: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>;
};

type StripeElementsGroup = {
    submit: () => Promise<{ error?: { message?: string } | null }>;
    update: (options: Record<string, unknown>) => void;
    create: (type: 'expressCheckout', options: Record<string, unknown>) => StripeExpressCheckoutElement;
};

type StripeExpressCheckoutElement = {
    mount: (element: HTMLElement) => void;
    on(event: 'availablepaymentmethodschange', handler: (event: { paymentMethods: Record<string, unknown> | null }) => void): void;
    on(event: 'shippingaddresschange', handler: (event: StripeExpressShippingAddressChangeEvent) => void): void;
    on(event: 'shippingratechange', handler: (event: StripeExpressShippingRateChangeEvent) => void): void;
    on(event: 'confirm', handler: (event: StripeExpressConfirmEvent) => void): void;
};

type StripeExpressShippingAddressChangeEvent = {
    address: { city?: string; state?: string; postal_code?: string; country?: string };
    resolve: (payload: Record<string, unknown>) => void;
    reject: () => void;
};

type StripeExpressShippingRateChangeEvent = {
    shippingRate: { id: string; amount: number };
    resolve: (payload: Record<string, unknown>) => void;
    reject: () => void;
};

type StripeExpressConfirmEvent = {
    expressPaymentType: string;
    billingDetails?: { name?: string; email?: string; phone?: string; address?: StripeAddress };
    shippingAddress?: { name?: string; address?: StripeAddress };
    shippingRate?: { id: string; amount: number };
    paymentFailed: (payload: { reason?: string; message?: string }) => void;
};

// Height of an Express Checkout wallet button (matches the PayPal button next to it).
const WALLET_BUTTON_MIN_HEIGHT = 45;

export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number;
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    paypalClientId: string | null;
    paypalEnvironment: 'production' | 'sandbox';
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
    // Admin on/off switches for the Stripe wallets; a switched-off wallet isn't mounted at all.
    applePayEnabled?: boolean;
    googlePayEnabled?: boolean;
    // Amazon Pay is a redirect method: the order is placed first, then the shopper leaves for Amazon.
    // Off by default; onRedirectStart lets the page clear the cart right before that redirect.
    amazonPayEnabled?: boolean;
    onRedirectStart?: () => void;
    // Told whether Stripe's Google Pay button is actually usable in this browser; the checkout offers
    // Airwallex's Google Pay as a fallback when it is not.
    onGooglePayAvailability?: (available: boolean) => void;
}

export function ExpressCheckout({ items, couponCode, subtotalMinor, stripeInstance, paypalClientId, paypalEnvironment, onOrderPlaced, applePayEnabled = true, googlePayEnabled = true, amazonPayEnabled = false, onRedirectStart, onGooglePayAvailability }: ExpressCheckoutProps) {
    const [canApplePay, setCanApplePay] = useState(false);
    const [canGooglePay, setCanGooglePay] = useState(false);
    const [canAmazonPay, setCanAmazonPay] = useState(false);
    const [canPayPal, setCanPayPal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const appleButtonMountRef = useRef<HTMLDivElement>(null);
    const googleButtonMountRef = useRef<HTMLDivElement>(null);
    const amazonButtonMountRef = useRef<HTMLDivElement>(null);
    const onRedirectStartRef = useRef(onRedirectStart);
    const onGooglePayAvailabilityRef = useRef(onGooglePayAvailability);
    const paypalButtonMountRef = useRef<HTMLDivElement>(null);
    const paypalSdkInstanceRef = useRef<PayPalSdkInstance | null>(null);

    // Read via .current inside effect callbacks instead of closing over the
    // props directly, so the mount effects below only need to depend on
    // stripeInstance/paypalClientId (which settle once) rather than on
    // items/couponCode/subtotalMinor/onOrderPlaced, which change identity on
    // every CheckoutPage re-render and would otherwise re-run the effect and
    // stack a duplicate wallet button on top of the previous one each time.
    const itemsRef = useRef(items);
    const couponCodeRef = useRef(couponCode);
    const subtotalMinorRef = useRef(subtotalMinor);
    const onOrderPlacedRef = useRef(onOrderPlaced);
    useEffect(() => {
        itemsRef.current = items;
        couponCodeRef.current = couponCode;
        subtotalMinorRef.current = subtotalMinor;
        onOrderPlacedRef.current = onOrderPlaced;
        onRedirectStartRef.current = onRedirectStart;
        onGooglePayAvailabilityRef.current = onGooglePayAvailability;
    }, [items, couponCode, subtotalMinor, onOrderPlaced, onRedirectStart, onGooglePayAvailability]);

    useEffect(() => {
        if (!stripeInstance || typeof (stripeInstance as unknown as Partial<StripeElementsInstance>).elements !== 'function') return;
        let cancelled = false;
        const stripe = stripeInstance as unknown as StripeElementsInstance;

        // Apple Pay and Google Pay each get their own Elements group and
        // their own 'expressCheckout' instance, restricted via
        // paymentMethods to show only that one wallet, mounted into their
        // own <div>. That's what makes 3 genuinely equal-width, independent
        // buttons (PayPal | Apple Pay | Google Pay) possible in one row --
        // a single expressCheckout instance bundles every enabled wallet
        // into one shared mount point sized as a unit, not as N equal
        // buttons.
        const mountWallet = (
            walletKey: 'applePay' | 'googlePay' | 'amazonPay',
            setCanPay: (value: boolean) => void,
            mountRef: React.RefObject<HTMLDivElement | null>,
        ) => {
            const elements = stripe.elements({
                mode: 'payment',
                amount: subtotalMinorRef.current,
                currency: 'usd',
            });
            let latestShippingRate: { code: string; name: string; price_minor: number } | null = null;

            const expressCheckoutElement = elements.create('expressCheckout', {
                emailRequired: true,
                shippingAddressRequired: true,
                allowedShippingCountries: ['US'],
                paymentMethods: {
                    applePay: walletKey === 'applePay' ? 'always' : 'never',
                    googlePay: walletKey === 'googlePay' ? 'always' : 'never',
                    paypal: 'never',
                    // Stripe only accepts 'auto' | 'never' for amazonPay (applePay/googlePay also take 'always').
                    amazonPay: walletKey === 'amazonPay' ? 'auto' : 'never',
                    klarna: 'never',
                    link: 'never',
                },
                // googlePay defaults to the 'buy' button type ("Buy with"
                // text); 'plain' matches applePay's own default (logo only).
                buttonType: { googlePay: 'plain' },
                buttonTheme: { applePay: 'black', googlePay: 'black' },
            });

            expressCheckoutElement.on('availablepaymentmethodschange', (event) => {
                if (cancelled) return;
                setCanPay(Boolean(event.paymentMethods));
                if (walletKey === 'googlePay') onGooglePayAvailabilityRef.current?.(Boolean(event.paymentMethods));
            });

            expressCheckoutElement.on('shippingaddresschange', async (event) => {
                try {
                    const address = {
                        country: event.address.country ?? 'US',
                        state: event.address.state ?? '',
                        city: event.address.city ?? '',
                        postcode: event.address.postal_code ?? '',
                    };
                    const ratesResponse = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinorRef.current}${couponCodeRef.current ? `&coupon_code=${encodeURIComponent(couponCodeRef.current)}` : ''}`);
                    const rates = await ratesResponse.json();
                    const rate = rates.rates?.[0];
                    if (!rate) { event.reject(); return; }

                    const taxResponse = await fetchApi('/api/checkout/tax-quote', {
                        method: 'POST',
                        body: { shipping: address, subtotal_amount: subtotalMinorRef.current / 100 },
                    });
                    const taxMinor = (await taxResponse.json()).quote?.tax_amount ?? 0;
                    latestShippingRate = { code: rate.code, name: rate.name, price_minor: rate.price_minor };
                    elements.update({ amount: subtotalMinorRef.current + rate.price_minor + taxMinor });
                    event.resolve({
                        shippingRates: [{ id: rate.code, displayName: rate.name, amount: rate.price_minor }],
                        lineItems: [
                            { name: 'Subtotal', amount: subtotalMinorRef.current },
                            { name: 'Tax', amount: taxMinor },
                        ],
                    });
                } catch {
                    event.reject();
                }
            });

            expressCheckoutElement.on('shippingratechange', (event) => {
                event.resolve({});
            });

            expressCheckoutElement.on('confirm', async (event) => {
                try {
                    const { error: submitError } = await elements.submit();
                    if (submitError) {
                        event.paymentFailed({ reason: 'fail', message: submitError.message });
                        return;
                    }

                    const walletAddress = event.shippingAddress?.address;
                    const nameParts = (event.shippingAddress?.name ?? event.billingDetails?.name ?? '').split(' ');
                    const shipping = {
                        email: event.billingDetails?.email ?? '',
                        first_name: nameParts[0] ?? '',
                        last_name: nameParts.slice(1).join(' '),
                        line_one: walletAddress?.line1 ?? '',
                        line_two: walletAddress?.line2 ?? null,
                        city: walletAddress?.city ?? '',
                        state: walletAddress?.state ?? '',
                        postcode: walletAddress?.postal_code ?? '',
                        country: walletAddress?.country ?? 'US',
                        phone: event.billingDetails?.phone ?? null,
                    };

                    if (walletKey === 'amazonPay') {
                        // Redirect method: same session + place-order calls as the normal checkout form
                        // (the intent is amazon_pay-typed, not a card), then Stripe sends the shopper to Amazon.
                        const sessionResponse = await fetchApi('/api/checkout/stripe-alt-session', {
                            method: 'POST',
                            body: {
                                payment_method: 'amazon_pay', items: itemsRef.current, coupon_code: couponCodeRef.current,
                                shipping_method: latestShippingRate?.code ?? null, email: shipping.email,
                                shipping, billing_same_as_shipping: true,
                            },
                        });
                        const sessionData = await sessionResponse.json();
                        const session = sessionData?.session;
                        if (!sessionResponse.ok || !session?.client_secret) {
                            event.paymentFailed({ reason: 'fail', message: sessionData?.message || 'Unable to prepare payment. Please try again.' });
                            return;
                        }

                        const amazonOrderResponse = await fetchApi('/api/checkout/place-order', {
                            method: 'POST', headers: { 'Idempotency-Key': session.intent_id },
                            body: {
                                items: itemsRef.current, shipping, billing_same_as_shipping: true,
                                shipping_method: latestShippingRate?.code ?? null, payment_method: 'amazon_pay',
                                payment_context: { intent_id: session.intent_id, session_id: session.session_id },
                                coupon_code: couponCodeRef.current,
                            },
                        });
                        const amazonOrder = await amazonOrderResponse.json();
                        if (amazonOrderResponse.status !== 201 || !amazonOrder?.order?.tracking_access_token) {
                            event.paymentFailed({ reason: 'fail', message: amazonOrder?.message || 'Order could not be created. Please try again.' });
                            return;
                        }

                        sessionStorage.setItem(`petposture_payment_access:${session.session_id}`, JSON.stringify({
                            email: shipping.email,
                            trackingToken: amazonOrder.order.tracking_access_token,
                        }));
                        onRedirectStartRef.current?.();

                        const { error: amazonConfirmError } = await stripe.confirmPayment({
                            elements,
                            clientSecret: session.client_secret,
                            confirmParams: { return_url: session.return_url },
                        });
                        if (amazonConfirmError) {
                            // The order is saved and the cart is gone: land on the confirmation page,
                            // which offers a retry, instead of leaving the shopper on an empty checkout.
                            window.location.href = `${session.return_url}&redirect_status=failed`;
                        }
                        return;
                    }

                    const intentResponse = await fetchApi('/api/checkout/payment-intent', {
                        method: 'POST',
                        body: {
                            payment_method: 'card', items: itemsRef.current, coupon_code: couponCodeRef.current,
                            shipping_method: latestShippingRate?.code ?? null,
                            shipping: { state: shipping.state, country: shipping.country, city: shipping.city, postcode: shipping.postcode },
                            currency: 'usd', email: shipping.email,
                        },
                    });
                    const intent = await intentResponse.json();
                    if (!intentResponse.ok || !intent?.payment_intent) {
                        event.paymentFailed({ reason: 'fail', message: intent?.message || 'Unable to prepare payment. Please try again.' });
                        return;
                    }

                    const { error: confirmError } = await stripe.confirmPayment({
                        elements,
                        clientSecret: intent.payment_intent.client_secret,
                        confirmParams: { return_url: window.location.href },
                        redirect: 'if_required',
                    });
                    if (confirmError) {
                        event.paymentFailed({ reason: 'fail', message: confirmError.message ?? 'Payment could not be confirmed.' });
                        return;
                    }

                    const orderResponse = await fetchApi('/api/checkout/place-order', {
                        method: 'POST', headers: { 'Idempotency-Key': intent.payment_intent.intent_id },
                        body: {
                            items: itemsRef.current, shipping, billing_same_as_shipping: true,
                            shipping_method: latestShippingRate?.code ?? null, payment_method: 'card',
                            // The wallet flag lets the backend apply the wallet's own admin switch
                            // (the order is a card payment as far as Stripe is concerned).
                            payment_context: { intent_id: intent.payment_intent.intent_id, wallet: walletKey === 'applePay' ? 'apple_pay' : 'google_pay' },
                            coupon_code: couponCodeRef.current,
                        },
                    });
                    const order = await orderResponse.json();
                    if (orderResponse.status !== 201 || !order?.order?.reference || !order?.order?.tracking_access_token) {
                        setError(order?.message || 'Order could not be created. Please try again.');
                        return;
                    }
                    onOrderPlacedRef.current({ reference: order.order.reference, trackingToken: order.order.tracking_access_token });
                } catch {
                    event.paymentFailed({ reason: 'fail' });
                    setError('Something went wrong. Please try again.');
                }
            });

            // The mount <div> is always rendered in the JSX (visibility is
            // what toggles on canPay, not presence) specifically so it
            // exists here, on this very first synchronous pass -- the
            // Express Checkout Element only fires
            // 'availablepaymentmethodschange' (which is what flips canPay
            // true) *after* it has been mounted, so deferring the mount
            // call until canPay is true would deadlock.
            if (mountRef.current) {
                mountRef.current.innerHTML = '';
                expressCheckoutElement.mount(mountRef.current);
            }
        };

        if (applePayEnabled) mountWallet('applePay', setCanApplePay, appleButtonMountRef);
        if (googlePayEnabled) mountWallet('googlePay', setCanGooglePay, googleButtonMountRef);
        if (amazonPayEnabled) mountWallet('amazonPay', setCanAmazonPay, amazonButtonMountRef);

        return () => { cancelled = true; };
        // items/couponCode/subtotalMinor/onOrderPlaced are read via refs above
        // on purpose -- see the comment where those refs are declared.
    }, [stripeInstance, applePayEnabled, googlePayEnabled, amazonPayEnabled]);

    // PayPal's v6 Web SDK reports eligibility asynchronously via its own
    // findEligibleMethods() call rather than an event fired only after
    // mounting, so (unlike the Stripe Element above) there's no deadlock
    // risk in waiting for canPayPal before creating the <paypal-button>
    // element in the effect below.
    useEffect(() => {
        if (!paypalClientId) return;
        let cancelled = false;

        (async () => {
            try {
                await loadPayPalSdk(paypalEnvironment);
                if (cancelled || !window.paypal) return;
                const sdkInstance = await window.paypal.createInstance({
                    clientId: paypalClientId,
                    components: ['paypal-payments'],
                    pageType: 'checkout',
                });
                if (cancelled) return;
                paypalSdkInstanceRef.current = sdkInstance;
                setCanPayPal(true);
                const eligibility = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
                if (cancelled) return;
                setCanPayPal(eligibility.isEligible('paypal'));
            } catch {
                if (!cancelled) setCanPayPal(false);
            }
        })();

        return () => { cancelled = true; };
    }, [paypalClientId, paypalEnvironment]);

    useEffect(() => {
        if (!canPayPal || !paypalSdkInstanceRef.current || !paypalButtonMountRef.current) return;
        const sdkInstance = paypalSdkInstanceRef.current;
        const mountEl = paypalButtonMountRef.current;
        mountEl.innerHTML = '';

        const session = sdkInstance.createPayPalOneTimePaymentSession({
            commit: true,
            onShippingAddressChange: async (data) => {
                const address = {
                    country: data.shippingAddress.countryCode ?? 'US',
                    state: data.shippingAddress.state ?? '',
                    city: data.shippingAddress.city ?? '',
                    postcode: data.shippingAddress.postalCode ?? '',
                };
                // calculateTotals() on the backend recomputes shipping/tax
                // and patches the PayPal order's amount directly -- v6 has
                // no client-side order.patch() like v5 did, so there's
                // nothing further to resolve/return here.
                const response = await fetchApi('/api/checkout/paypal-order/amount', {
                    method: 'POST',
                    body: { paypal_order_id: data.orderId, items: itemsRef.current, coupon_code: couponCodeRef.current, shipping: address },
                });
                if (!response.ok) throw new Error('Unable to update PayPal order amount.');
            },
            onApprove: async (data) => {
                try {
                    // v6's onApprove carries no shipping address (unlike
                    // v5's onApprove), so it must be fetched from the order
                    // itself before placing the order.
                    const shippingResponse = await fetchApi('/api/checkout/paypal-order/shipping', {
                        method: 'POST', body: { paypal_order_id: data.orderId },
                    });
                    const shippingData = await shippingResponse.json();
                    if (!shippingResponse.ok || !shippingData?.shipping) {
                        setError('Unable to retrieve shipping details. Please try again.');
                        return;
                    }

                    const orderResponse = await fetchApi('/api/checkout/place-order', {
                        method: 'POST', headers: { 'Idempotency-Key': data.orderId },
                        body: {
                            items: itemsRef.current, shipping: shippingData.shipping, billing_same_as_shipping: true,
                            payment_method: 'paypal', payment_context: { paypal_order_id: data.orderId }, coupon_code: couponCodeRef.current,
                        },
                    });
                    const order = await orderResponse.json();
                    if (orderResponse.status !== 201 || !order?.order?.reference || !order?.order?.tracking_access_token) {
                        setError(order?.message || 'Order could not be created. Please try again.');
                        return;
                    }

                    const captureResponse = await fetchApi('/api/checkout/paypal-capture', { method: 'POST', body: { paypal_order_id: data.orderId } });
                    const capture = await captureResponse.json();
                    if (!captureResponse.ok || capture?.capture?.status !== 'COMPLETED') {
                        setError('Payment could not be captured. Please try again.');
                        return;
                    }
                    onOrderPlacedRef.current({ reference: order.order.reference, trackingToken: order.order.tracking_access_token });
                } catch {
                    setError('Something went wrong. Please try again.');
                }
            },
            onError: (data) => setError(data.message || 'Something went wrong. Please try again.'),
        });

        // v6's <paypal-button> element has no logo-only variant -- every
        // `type` value prepends a verb ("Pay with", "Buy Now", "Checkout",
        // "Donate", "Subscribe") before the wordmark, confirmed live by
        // cycling through all of them and inspecting the shadow DOM; hiding
        // the text node via injected CSS also didn't stick through the
        // SDK's own re-renders. A plain button with the same PayPal logo
        // asset already used elsewhere on this checkout page (the payment
        // method radio option) is the only reliable way to show just the
        // logo.
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', 'Pay with PayPal');
        button.className = 'flex h-11 w-full items-center justify-center rounded-md bg-[#ffc439] transition-colors hover:bg-[#f2ba36]';
        const logo = document.createElement('img');
        logo.src = 'https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png';
        logo.alt = 'PayPal';
        logo.className = 'h-5 w-auto';
        button.appendChild(logo);
        const handleClick = () => {
            const createOrderPromise = fetchApi('/api/checkout/paypal-order', {
                method: 'POST',
                body: { payment_method: 'paypal', items: itemsRef.current, coupon_code: couponCodeRef.current, currency: 'usd' },
            }).then(async (response) => {
                const data = await response.json();
                if (!response.ok || !data?.paypal_order?.paypal_order_id) throw new Error(data?.message || 'Unable to start PayPal checkout.');
                return { orderId: data.paypal_order.paypal_order_id as string };
            });
            session.start({ presentationMode: 'auto' }, createOrderPromise)
                .catch(() => setError('Something went wrong. Please try again.'));
        };
        button.addEventListener('click', handleClick);
        mountEl.appendChild(button);

        return () => {
            button.removeEventListener('click', handleClick);
            mountEl.innerHTML = '';
        };
        // items/couponCode/onOrderPlaced are read via refs above on purpose
        // -- see the comment where those refs are declared.
    }, [canPayPal]);

    const anyAvailable = canApplePay || canGooglePay || canAmazonPay || canPayPal;
    // Gating the initial render itself on anyAvailable would mean the mount
    // <div>s below never attach to real DOM nodes until something is
    // already known available -- but nothing is known synchronously any
    // more now that PayPal's eligibility (like Apple/Google Pay's) is only
    // discovered async, so that would permanently deadlock every wallet.
    // A client id being configured is the one signal known up front, so it
    // gates whether the component attempts to render at all; anyAvailable
    // only controls the label/divider's visibility once eligibility settles.
    const hasStripeWallet = Boolean(stripeInstance) && (applePayEnabled || googlePayEnabled || amazonPayEnabled);
    if (!paypalClientId && !hasStripeWallet) return null;

    return (
        <div className="mb-8 space-y-4">
            {anyAvailable && <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>}
            {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
            {/* PayPal's v5 Buttons SDK rendered its iframe at a hard floor of
                300px, which clipped in an equal third -- confirmed across 6
                different style configs. The v6 Web SDK's <paypal-button>
                custom element (what Shopify itself uses) has no such floor,
                so all three wallets can share one equal-width row with
                min-w-0 (flex items default to min-width: auto, which would
                otherwise let any child's intrinsic content width override
                the equal flex-basis). */}
            <div className="flex flex-col gap-3 sm:flex-row">
                {/* A switched-off wallet is not rendered at all, so the remaining buttons share the row. */}
                {paypalClientId && <div ref={paypalButtonMountRef} className="min-w-0 overflow-hidden sm:flex-1" style={{ visibility: canPayPal ? 'visible' : 'hidden' }} />}
                {/* Stripe sizes its iframe to this slot: without the PayPal button next to it giving the
                    row a height, an auto-height slot collapses the wallet button to 8px. Reserve the
                    button height only while the wallet is actually available (no blank gap otherwise). */}
                {amazonPayEnabled && <div ref={amazonButtonMountRef} className="min-w-0 overflow-hidden transition-opacity hover:opacity-85 sm:flex-1" style={{ visibility: canAmazonPay ? 'visible' : 'hidden', minHeight: canAmazonPay ? WALLET_BUTTON_MIN_HEIGHT : 0 }} />}
                {applePayEnabled && <div ref={appleButtonMountRef} className="min-w-0 overflow-hidden transition-opacity hover:opacity-85 sm:flex-1" style={{ visibility: canApplePay ? 'visible' : 'hidden', minHeight: canApplePay ? WALLET_BUTTON_MIN_HEIGHT : 0 }} />}
                {googlePayEnabled && <div ref={googleButtonMountRef} className="min-w-0 overflow-hidden transition-opacity hover:opacity-85 sm:flex-1" style={{ visibility: canGooglePay ? 'visible' : 'hidden', minHeight: canGooglePay ? WALLET_BUTTON_MIN_HEIGHT : 0 }} />}            </div>
            {anyAvailable && (
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#e8e8ea]" />
                    <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                    <div className="h-px flex-1 bg-[#e8e8ea]" />
                </div>
            )}
        </div>
    );
}
