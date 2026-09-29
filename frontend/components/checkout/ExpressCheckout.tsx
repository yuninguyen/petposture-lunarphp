'use client';

import { useState } from 'react';

export interface ExpressCheckoutProps {
    items: Array<{ variantId: number; quantity: number }>;
    couponCode: string | null;
    subtotalMinor: number;
    stripeInstance: ReturnType<NonNullable<typeof window.Stripe>> | null;
    paypalClientId: string | null;
    onOrderPlaced: (orderAccess: { reference: string; trackingToken: string }) => void;
}

export function ExpressCheckout(props: ExpressCheckoutProps) {
    void props;
    const [canApplePay] = useState(false);
    const [canGooglePay] = useState(false);
    const [canPayPal] = useState(false);

    const anyAvailable = canApplePay || canGooglePay || canPayPal;
    if (!anyAvailable) return null;

    return (
        <div className="mb-8 space-y-4">
            <p className="text-center text-[13px] font-medium uppercase tracking-wide text-[#707070]">
                Express checkout
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" />
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e8e8ea]" />
                <span className="text-[12px] font-medium uppercase text-[#a0a0a0]">Or</span>
                <div className="h-px flex-1 bg-[#e8e8ea]" />
            </div>
        </div>
    );
}
