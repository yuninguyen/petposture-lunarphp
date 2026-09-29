'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../../lib/fetchApi';

type StripeWalletInstance = {
    paymentRequest: (options: Record<string, unknown>) => {
        canMakePayment: () => Promise<{ applePay?: boolean } | null>;
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

export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number;
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    paypalClientId: string | null;
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout({ items, couponCode, subtotalMinor, stripeInstance, onOrderPlaced }: ExpressCheckoutProps) {
    const [canApplePay, setCanApplePay] = useState(false);
    const [canGooglePay, setCanGooglePay] = useState(false);
    const [canPayPal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const stripeButtonMountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!stripeInstance || typeof (stripeInstance as unknown as Partial<StripeWalletInstance>).paymentRequest !== 'function') return;
        let cancelled = false;
        const stripe = stripeInstance as unknown as StripeWalletInstance;
        const paymentRequest = stripe.paymentRequest({
            country: 'US',
            currency: 'usd',
            total: { label: 'PetPosture', amount: subtotalMinor },
            requestPayerName: true,
            requestPayerEmail: true,
            requestShipping: true,
        });

        paymentRequest.canMakePayment().then((result) => {
            if (cancelled || !result) return;
            setCanApplePay(Boolean(result.applePay));
            setCanGooglePay(!result.applePay);
        });

        paymentRequest.on('shippingaddresschange', async (event) => {
            try {
                const address = {
                    country: event.shippingAddress.country,
                    state: event.shippingAddress.region,
                    city: event.shippingAddress.city,
                    postcode: event.shippingAddress.postalCode,
                };
                const ratesResponse = await fetchApi(`/api/checkout/shipping-rates?subtotal_minor=${subtotalMinor}${couponCode ? `&coupon_code=${encodeURIComponent(couponCode)}` : ''}`);
                const rates = await ratesResponse.json();
                const rate = rates.rates?.[0];
                if (!rate) return event.updateWith({ status: 'invalid_shipping_address' });

                const taxResponse = await fetchApi('/api/checkout/tax-quote', {
                    method: 'POST',
                    body: { shipping: address, subtotal_amount: subtotalMinor / 100 },
                });
                const tax = await taxResponse.json();
                const shippingMinor = rate.price_minor;
                const taxMinor = tax.quote?.tax_amount ?? 0;
                event.updateWith({
                    status: 'success',
                    shippingOptions: [{ id: rate.code, label: rate.name, detail: '', amount: shippingMinor }],
                    total: { label: 'PetPosture', amount: subtotalMinor + shippingMinor + taxMinor },
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
                        payment_method: 'card', items, coupon_code: couponCode,
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
                    method: 'POST', headers: { 'Idempotency-Key': intent.payment_intent.id },
                    body: {
                        items, shipping, billing_same_as_shipping: true,
                        shipping_method: event.shippingOption?.id ?? null, payment_method: 'card',
                        payment_context: { intent_id: intent.payment_intent.id }, coupon_code: couponCode,
                    },
                });
                const order = await orderResponse.json();
                if (orderResponse.status !== 201 || !order?.order?.reference || !order?.order?.tracking_access_token) {
                    setError(order?.message || 'Order could not be created. Please try again.');
                    return;
                }
                onOrderPlaced({ reference: order.order.reference, trackingToken: order.order.tracking_access_token });
            } catch {
                event.complete('fail');
                setError('Something went wrong. Please try again.');
            }
        });

        if (stripeButtonMountRef.current) {
            stripe.elements().create('paymentRequestButton', { paymentRequest }).mount(stripeButtonMountRef.current);
        }
        return () => { cancelled = true; };
    }, [stripeInstance, items, couponCode, subtotalMinor, onOrderPlaced]);

    const anyAvailable = canApplePay || canGooglePay || canPayPal;
    if (!anyAvailable) return null;

    return (
        <div className="mb-8 space-y-4">
            <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">Express checkout</p>
            {error && <p role="alert" className="text-center text-[13px] text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(canApplePay || canGooglePay) && <div ref={stripeButtonMountRef} className="h-11" />}
            </div>
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e8e8ea]" />
                <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                <div className="h-px flex-1 bg-[#e8e8ea]" />
            </div>
        </div>
    );
}
