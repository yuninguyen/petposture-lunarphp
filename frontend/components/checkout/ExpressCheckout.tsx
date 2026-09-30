'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

declare global {
    interface Window {
        paypal?: { Buttons: (options: Record<string, unknown>) => { render: (element: HTMLElement) => void } };
    }
}

type StripeWalletInstance = {
    paymentRequest: (options: Record<string, unknown>) => {
        canMakePayment: () => Promise<{ applePay?: boolean; googlePay?: boolean } | null>;
        on(event: 'shippingaddresschange', handler: (event: StripeShippingAddressChangeEvent) => void): void;
        on(event: 'paymentmethod', handler: (event: StripePaymentMethodEvent) => void): void;
    };
    elements: () => {
        create: (type: 'paymentRequestButton', options: Record<string, unknown>) => { mount: (element: HTMLElement) => void };
    };
    confirmCardPayment: (
        clientSecret: string,
        data: Record<string, unknown>,
        options: Record<string, unknown>,
    ) => Promise<{ error?: { message?: string } | null }>;
};

type StripeShippingAddressChangeEvent = {
    shippingAddress: { country: string; region: string; city: string; postalCode: string };
    updateWith: (details: Record<string, unknown>) => void;
};

type StripePaymentMethodEvent = {
    payerEmail?: string;
    payerPhone?: string;
    paymentMethod: { id: string };
    shippingOption?: { id: string };
    shippingAddress?: {
        recipient?: string;
        addressLine?: string[];
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
    };
    complete: (status: 'success' | 'fail') => void;
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
    const [canApplePay, setCanApplePay] = useState(false);
    const [canGooglePay, setCanGooglePay] = useState(false);
    // Unlike Apple Pay/Google Pay (which need an async canMakePayment()
    // check), PayPal's availability is knowable synchronously from the
    // first render -- it only needs a client id. Keeping it as async state
    // instead of a derived value previously caused a mount-order race: the
    // effect's first pass ran before the <div ref={paypalButtonMountRef}>
    // existed in the DOM (because that div was itself gated on this same
    // state), so window.paypal.Buttons(...).render() had no element to
    // attach to on that pass.
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
        if (!stripeInstance || typeof (stripeInstance as unknown as Partial<StripeWalletInstance>).paymentRequest !== 'function') return;
        let cancelled = false;
        const stripe = stripeInstance as unknown as StripeWalletInstance;
        const paymentRequest = stripe.paymentRequest({
            country: 'US',
            currency: 'usd',
            total: { label: 'PetPosture', amount: subtotalMinorRef.current },
            requestPayerName: true,
            requestPayerEmail: true,
            requestShipping: true,
        });

        paymentRequest.canMakePayment().then((result) => {
            if (cancelled || !result) return;
            setCanApplePay(Boolean(result.applePay));
            setCanGooglePay(Boolean(result.googlePay));
        });

        paymentRequest.on('shippingaddresschange', async (event) => {
            try {
                const address = {
                    country: event.shippingAddress.country,
                    state: event.shippingAddress.region,
                    city: event.shippingAddress.city,
                    postcode: event.shippingAddress.postalCode,
                };
                const ratesResponse = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinorRef.current}${couponCodeRef.current ? `&coupon_code=${encodeURIComponent(couponCodeRef.current)}` : ''}`);
                const rates = await ratesResponse.json();
                const rate = rates.rates?.[0];
                if (!rate) return event.updateWith({ status: 'invalid_shipping_address' });

                const taxResponse = await fetchApi('/api/checkout/tax-quote', {
                    method: 'POST',
                    body: { shipping: address, subtotal_amount: subtotalMinorRef.current / 100 },
                });
                const tax = await taxResponse.json();
                const shippingMinor = rate.price_minor;
                const taxMinor = tax.quote?.tax_amount ?? 0;
                event.updateWith({
                    status: 'success',
                    shippingOptions: [{ id: rate.code, label: rate.name, detail: '', amount: shippingMinor }],
                    total: { label: 'PetPosture', amount: subtotalMinorRef.current + shippingMinor + taxMinor },
                });
            } catch {
                event.updateWith({ status: 'fail' });
            }
        });

        paymentRequest.on('paymentmethod', async (event) => {
            try {
                const shipping = {
                    email: event.payerEmail ?? '',
                    first_name: event.shippingAddress?.recipient?.split(' ')[0] ?? '',
                    last_name: event.shippingAddress?.recipient?.split(' ').slice(1).join(' ') ?? '',
                    line_one: event.shippingAddress?.addressLine?.[0] ?? '',
                    line_two: event.shippingAddress?.addressLine?.[1] ?? null,
                    city: event.shippingAddress?.city ?? '',
                    state: event.shippingAddress?.region ?? '',
                    postcode: event.shippingAddress?.postalCode ?? '',
                    country: event.shippingAddress?.country ?? 'US',
                    phone: event.payerPhone ?? null,
                };
                const intentResponse = await fetchApi('/api/checkout/payment-intent', {
                    method: 'POST',
                    body: {
                        payment_method: 'card', items: itemsRef.current, coupon_code: couponCodeRef.current,
                        shipping_method: event.shippingOption?.id ?? null,
                        shipping: { state: shipping.state, country: shipping.country, city: shipping.city, postcode: shipping.postcode },
                        currency: 'usd', email: shipping.email,
                    },
                });
                const intent = await intentResponse.json();
                if (!intentResponse.ok || !intent?.payment_intent) {
                    event.complete('fail');
                    setError(intent?.message || 'Unable to prepare payment. Please try again.');
                    return;
                }
                const { error: confirmError } = await stripe.confirmCardPayment(
                    intent.payment_intent.client_secret,
                    { payment_method: event.paymentMethod.id },
                    { handleActions: false },
                );
                if (confirmError) {
                    event.complete('fail');
                    setError(confirmError.message ?? 'Payment could not be confirmed.');
                    return;
                }
                event.complete('success');
                const orderResponse = await fetchApi('/api/checkout/place-order', {
                    method: 'POST', headers: { 'Idempotency-Key': intent.payment_intent.intent_id },
                    body: {
                        items: itemsRef.current, shipping, billing_same_as_shipping: true,
                        shipping_method: event.shippingOption?.id ?? null, payment_method: 'card',
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
                event.complete('fail');
                setError('Something went wrong. Please try again.');
            }
        });

        if (stripeButtonMountRef.current) {
            stripeButtonMountRef.current.innerHTML = '';
            stripe.elements().create('paymentRequestButton', { paymentRequest }).mount(stripeButtonMountRef.current);
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
                style: { layout: 'horizontal', label: 'paypal', height: 44 },
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

    const anyAvailable = canApplePay || canGooglePay || canPayPal;
    if (!anyAvailable) return null;

    return (
        <div className="mb-8 space-y-4">
            <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>
            {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(canApplePay || canGooglePay) && <div ref={stripeButtonMountRef} className="h-11" />}
                {canPayPal && <div ref={paypalButtonMountRef} />}
            </div>
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e8e8ea]" />
                <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                <div className="h-px flex-1 bg-[#e8e8ea]" />
            </div>
        </div>
    );
}
