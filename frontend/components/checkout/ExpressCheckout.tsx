'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

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

export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number;
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout({ items, couponCode, subtotalMinor, stripeInstance, onOrderPlaced }: ExpressCheckoutProps) {
    const [canExpressPay, setCanExpressPay] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const stripeButtonMountRef = useRef<HTMLDivElement>(null);

    // Read via .current inside effect callbacks instead of closing over the
    // props directly, so the mount effect below only needs to depend on
    // stripeInstance (which settles once) rather than on
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
        let latestShippingRate: { code: string; name: string; price_minor: number } | null = null;

        const expressCheckoutElement = elements.create('expressCheckout', {
            emailRequired: true,
            shippingAddressRequired: true,
            allowedShippingCountries: ['US'],
            // PayPal rides the same Stripe-confirmed PaymentIntent as Apple
            // Pay/Google Pay here (paymentMethods.paypal: 'auto'), rather
            // than a separate PayPal Buttons SDK integration -- that keeps
            // all three in the one Express Checkout Element mount point, so
            // Stripe's own layout.maxColumns lays them out as genuinely
            // equal-width buttons in a single row instead of two separately
            // sized DOM elements (a Stripe iframe next to a PayPal iframe)
            // that can't be visually unified with CSS alone.
            paymentMethods: {
                applePay: 'always',
                googlePay: 'always',
                paypal: 'auto',
                amazonPay: 'never',
                klarna: 'never',
                link: 'never',
            },
            layout: { maxColumns: 3 },
            // googlePay defaults to the 'buy' button type ("Buy with"
            // text); 'plain' matches applePay's own default (logo only).
            buttonType: { googlePay: 'plain' },
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

                // Regardless of which wallet the customer picked inside the
                // Element (Apple Pay, Google Pay, or PayPal), Stripe confirms
                // it as the same kind of PaymentIntent, so it's placed
                // through the existing card/Stripe order path either way.
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

    // stripeInstance null means nothing will ever be mounted (the effect
    // above never gets a real elements group to work with), so there is
    // truly nothing to show -- unlike canExpressPay being merely not-yet-
    // resolved, where the mount <div> below still needs to exist in the DOM
    // for the Express Checkout Element to mount into and determine
    // availability in the first place.
    if (!stripeInstance) return null;

    return (
        <div className="mb-8 space-y-4" style={{ visibility: canExpressPay ? 'visible' : 'hidden' }}>
            <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>
            {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
            <div ref={stripeButtonMountRef} />
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e8e8ea]" />
                <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                <div className="h-px flex-1 bg-[#e8e8ea]" />
            </div>
        </div>
    );
}
