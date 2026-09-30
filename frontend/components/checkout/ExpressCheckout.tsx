'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

declare global {
    interface Window {
        paypal?: { Buttons: (options: Record<string, unknown>) => { render: (element: HTMLElement) => void } };
    }
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

type PayPalShippingData = { orderInfo?: { shipping_address?: { country_code?: string; state?: string; city?: string; postal_code?: string; address_line_1?: string; address_line_2?: string } }; payer?: { email_address?: string; name?: { given_name?: string; surname?: string }; phone?: { phone_number?: { national_number?: string } } } };
type PayPalActions = { order: { patch: (operations: unknown[]) => Promise<void> }; reject: () => void };
type PayPalApproval = { orderID: string };

export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number;
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    paypalClientId: string | null;
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout({ items, couponCode, subtotalMinor, stripeInstance, paypalClientId, onOrderPlaced }: ExpressCheckoutProps) {
    const [canExpressPay, setCanExpressPay] = useState(false);
    // Unlike Apple Pay/Google Pay (which need an async canMakePayment()
    // check), PayPal's availability is knowable synchronously from the
    // first render -- it only needs a client id.
    const canPayPal = Boolean(paypalClientId);
    const [error, setError] = useState<string | null>(null);
    const stripeButtonMountRef = useRef<HTMLDivElement>(null);
    const paypalButtonMountRef = useRef<HTMLDivElement>(null);
    const latestShippingAddressRef = useRef<Record<string, unknown> | null>(null);

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
    }, [items, couponCode, subtotalMinor, onOrderPlaced]);

    useEffect(() => {
        if (!stripeInstance || typeof (stripeInstance as unknown as Partial<StripeElementsInstance>).elements !== 'function') return;
        let cancelled = false;
        const stripe = stripeInstance as unknown as StripeElementsInstance;
        const elements = stripe.elements({
            mode: 'payment',
            amount: subtotalMinorRef.current,
            currency: 'usd',
        });
        // Card is the only payment_method type this element shows -- Apple
        // Pay and Google Pay both ride on it (per Stripe's docs). PayPal is
        // excluded here and handled by the separate PayPal Buttons SDK
        // integration below instead: Stripe's own PayPal support requires
        // additional activation on the Stripe Dashboard side (confirmed
        // unavailable on this account -- paypal.available: false from
        // Stripe's own eligibility check), so the already-working PayPal
        // integration (this account's real PayPal REST credentials) stays
        // in place rather than depending on that separate setup step.
        let latestShippingRate: { code: string; name: string; price_minor: number } | null = null;

        const expressCheckoutElement = elements.create('expressCheckout', {
            emailRequired: true,
            shippingAddressRequired: true,
            allowedShippingCountries: ['US'],
            paymentMethods: {
                applePay: 'always',
                googlePay: 'always',
                paypal: 'never',
                amazonPay: 'never',
                klarna: 'never',
                link: 'never',
            },
            layout: { maxColumns: 2 },
            // googlePay defaults to the 'buy' button type ("Buy with"
            // text); 'plain' matches applePay's own default (logo only).
            buttonType: { googlePay: 'plain' },
            buttonTheme: { applePay: 'black', googlePay: 'black' },
        });

        expressCheckoutElement.on('availablepaymentmethodschange', (event) => {
            if (cancelled) return;
            setCanExpressPay(Boolean(event.paymentMethods));
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
                        payment_context: { intent_id: intent.payment_intent.intent_id }, coupon_code: couponCodeRef.current,
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

        // The mount <div> is always rendered in the JSX (visibility is what
        // toggles on canExpressPay, not presence) specifically so it exists
        // here, on this very first synchronous pass -- the Express Checkout
        // Element only fires 'availablepaymentmethodschange' (which is what
        // flips canExpressPay true) *after* it has been mounted, so deferring
        // the mount call until canExpressPay is true would deadlock.
        if (stripeButtonMountRef.current) {
            stripeButtonMountRef.current.innerHTML = '';
            expressCheckoutElement.mount(stripeButtonMountRef.current);
        }
        return () => { cancelled = true; };
        // items/couponCode/subtotalMinor/onOrderPlaced are read via refs above
        // on purpose -- see the comment where those refs are declared.
    }, [stripeInstance]);

    useEffect(() => {
        if (!paypalClientId) return;
        let cancelled = false;
        const renderButtons = () => {
            if (cancelled || !window.paypal || !paypalButtonMountRef.current) return;
            window.paypal.Buttons({
                style: { layout: 'horizontal', label: 'paypal', height: 44, tagline: false },
                createOrder: async () => {
                    const response = await fetchApi('/api/checkout/paypal-order', {
                        method: 'POST', body: { payment_method: 'paypal', items: itemsRef.current, coupon_code: couponCodeRef.current, currency: 'usd' },
                    });
                    const data = await response.json();
                    if (!response.ok || !data?.paypal_order?.paypal_order_id) throw new Error(data?.message || 'Unable to start PayPal checkout.');
                    return data.paypal_order.paypal_order_id;
                },
                onShippingAddressChange: async (data: PayPalShippingData, actions: PayPalActions) => {
                    try {
                        const walletAddress = data.orderInfo?.shipping_address;
                        const address = { country: walletAddress?.country_code ?? 'US', state: walletAddress?.state ?? '', city: walletAddress?.city ?? '', postcode: walletAddress?.postal_code ?? '' };
                        const ratesResponse = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinorRef.current}${couponCodeRef.current ? `&coupon_code=${encodeURIComponent(couponCodeRef.current)}` : ''}`);
                        const rate = (await ratesResponse.json()).rates?.[0];
                        if (!rate) return actions.reject();
                        const taxResponse = await fetchApi('/api/checkout/tax-quote', { method: 'POST', body: { shipping: address, subtotal_amount: subtotalMinorRef.current / 100 } });
                        const taxMinor = (await taxResponse.json()).quote?.tax_amount ?? 0;
                        latestShippingAddressRef.current = {
                            email: data.payer?.email_address ?? '', first_name: data.payer?.name?.given_name ?? '', last_name: data.payer?.name?.surname ?? '',
                            line_one: walletAddress?.address_line_1 ?? '', line_two: walletAddress?.address_line_2 ?? null,
                            city: address.city, state: address.state, postcode: address.postcode, country: address.country,
                            phone: data.payer?.phone?.phone_number?.national_number ?? null,
                        };
                        return actions.order.patch([{ op: 'replace', path: "/purchase_units/@reference_id=='default'/amount", value: {
                            currency_code: 'USD', value: ((subtotalMinorRef.current + rate.price_minor + taxMinor) / 100).toFixed(2),
                            breakdown: { item_total: { currency_code: 'USD', value: (subtotalMinorRef.current / 100).toFixed(2) }, shipping: { currency_code: 'USD', value: (rate.price_minor / 100).toFixed(2) }, tax_total: { currency_code: 'USD', value: (taxMinor / 100).toFixed(2) } },
                        } }]);
                    } catch { actions.reject(); }
                },
                onApprove: async (data: PayPalApproval) => {
                    try {
                        if (!latestShippingAddressRef.current) { setError('Missing shipping address. Please try again.'); return; }
                        const orderResponse = await fetchApi('/api/checkout/place-order', { method: 'POST', headers: { 'Idempotency-Key': data.orderID }, body: { items: itemsRef.current, shipping: latestShippingAddressRef.current, billing_same_as_shipping: true, payment_method: 'paypal', payment_context: { paypal_order_id: data.orderID }, coupon_code: couponCodeRef.current } });
                        const order = await orderResponse.json();
                        if (orderResponse.status !== 201 || !order?.order?.reference || !order?.order?.tracking_access_token) { setError(order?.message || 'Order could not be created. Please try again.'); return; }
                        const captureResponse = await fetchApi('/api/checkout/paypal-capture', { method: 'POST', body: { paypal_order_id: data.orderID } });
                        const capture = await captureResponse.json();
                        if (!captureResponse.ok || capture?.capture?.status !== 'COMPLETED') { setError('Payment could not be captured. Please try again.'); return; }
                        onOrderPlacedRef.current({ reference: order.order.reference, trackingToken: order.order.tracking_access_token });
                    } catch { setError('Something went wrong. Please try again.'); }
                },
            }).render(paypalButtonMountRef.current);
        };
        const script = document.getElementById('paypal-express-sdk') as HTMLScriptElement | null;
        if (window.paypal) renderButtons();
        else if (!script) {
            const sdk = document.createElement('script');
            sdk.id = 'paypal-express-sdk';
            sdk.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&components=buttons`;
            sdk.addEventListener('load', renderButtons, { once: true });
            document.head.appendChild(sdk);
        } else script.addEventListener('load', renderButtons, { once: true });
        return () => { cancelled = true; };
        // items/couponCode/subtotalMinor/onOrderPlaced are read via refs above
        // on purpose -- see the comment where those refs are declared.
    }, [paypalClientId]);

    const anyAvailable = canExpressPay || canPayPal;
    if (!anyAvailable) return null;

    return (
        <div className="mb-8 space-y-4">
            <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>
            {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
            {/* PayPal first, then Apple Pay/Google Pay (bundled in one Stripe
                mount point -- Stripe's architecture doesn't allow splitting
                them into separate same-row elements). flex-1 on both keeps
                the two cells equal width regardless of how many buttons
                render inside the Stripe cell. */}
            <div className="flex flex-col gap-3 sm:flex-row">
                {canPayPal && <div ref={paypalButtonMountRef} className="sm:flex-1" />}
                <div ref={stripeButtonMountRef} className="sm:flex-1" style={{ visibility: canExpressPay ? 'visible' : 'hidden' }} />
            </div>
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e8e8ea]" />
                <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                <div className="h-px flex-1 bg-[#e8e8ea]" />
            </div>
        </div>
    );
}
