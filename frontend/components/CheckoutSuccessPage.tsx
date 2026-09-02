"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, Package, Truck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { fetchApi } from "@/lib/fetchApi";
import Header from "@/components/Header";
import RetryPaymentPanel from "@/components/orders/RetryPaymentPanel";

type TrackingOrder = {
    reference: string;
    tracking_access_token?: string;
    status: string;
    fulfillment_status: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    eta: string | null;
    shipping_address: {
        city: string | null;
        state: string | null;
        postcode: string | null;
        country: string | null;
    };
    created_at: string | null;
    shipping_method: string;
    total: number;
    sub_total: number;
    shipping_total: number;
    tax_total: number;
    discount_total: number;
    currency: string;
    lines: Array<{
        id: number;
        description: string;
        quantity: number;
        unit_price: number;
        sub_total: number;
        image: string | null;
    }>;
};

function formatMoney(value: number) {
    return `$${value.toFixed(2)}`;
}

function formatStatus(value: string) {
    return value.replace(/[_-]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

const STATUS_ORDER = ["awaiting-payment", "payment-offline", "payment-received", "processing", "shipped", "delivered"];

function buildTimeline(order: TrackingOrder) {
    if (order.status === "cancelled") {
        return [
            { key: "placed", label: "Order placed", done: true },
            { key: "cancelled", label: "Order cancelled", done: true },
        ];
    }

    const currentIndex = STATUS_ORDER.indexOf(order.status);
    const at = (key: string) => currentIndex >= STATUS_ORDER.indexOf(key);

    return [
        { key: "placed", label: "Order placed", done: true },
        { key: "payment", label: at("payment-received") ? "Payment confirmed" : "Awaiting payment", done: at("payment-received") },
        { key: "processing", label: "Preparing your order", done: at("processing") },
        { key: "shipped", label: "Shipped", done: at("shipped") },
        { key: "delivered", label: "Delivered", done: at("delivered") },
    ];
}

function OrderSuccessContent() {
    const searchParams = useSearchParams();
    const initialToken = searchParams.get("token") ?? "";
    const queryEmail = searchParams.get("email") ?? "";
    const gateway = searchParams.get("gateway") ?? "";
    const sessionId = searchParams.get("session_id") ?? "";
    const [trackingToken, setTrackingToken] = useState(initialToken);
    const [email, setEmail] = useState(queryEmail);
    const [order, setOrder] = useState<TrackingOrder | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOrder = async () => {
            setLoading(true);
            setError(null);

            try {
                const apiBase = getApiBaseUrl();
                let accessEmail = queryEmail;
                let response: Response;

                if (sessionId && !accessEmail) {
                    try {
                        const storedAccess = JSON.parse(sessionStorage.getItem(`petposture_payment_access:${sessionId}`) || "null") as { email?: string } | null;
                        accessEmail = storedAccess?.email || "";
                        if (accessEmail) {
                            setEmail(accessEmail);
                        }
                    } catch {
                        // Continue without optional locally persisted checkout context.
                    }
                }

                if (gateway === "paypal" && initialToken) {
                    // PayPal appends its own order id as `token` (and `PayerID`) when it
                    // redirects the buyer back — the order was already created before the
                    // redirect, but the payment still needs an explicit capture call.
                    // capturePayPalOrder() is idempotent server-side, so retrying here is
                    // safe; a transient network hiccup on this step shouldn't block the
                    // confirmation page — the order lookup below still works either way,
                    // and a failed capture can be retried on the next page load.
                    for (let attempt = 0; attempt < 2; attempt += 1) {
                        try {
                            const captureRes = await fetchApi('/api/checkout/paypal-capture', {
                                method: "POST",
                                body: { paypal_order_id: initialToken },
                            });

                            if (!captureRes.ok) {
                                const captureData = await captureRes.json().catch(() => null);
                                console.error("PayPal capture failed:", captureData?.message);
                            }

                            break;
                        } catch (captureError) {
                            console.error("PayPal capture request failed:", captureError);
                            if (attempt === 0) {
                                await new Promise((resolve) => setTimeout(resolve, 800));
                            }
                        }
                    }
                }

                if (gateway && sessionId) {
                    const lookupUrl = `${apiBase}/api/orders/by-payment-session?gateway=${encodeURIComponent(gateway)}&session_id=${encodeURIComponent(sessionId)}`;
                    try {
                        response = await fetch(lookupUrl);
                    } catch {
                        await new Promise((resolve) => setTimeout(resolve, 800));
                        response = await fetch(lookupUrl);
                    }
                } else {
                    if (!initialToken || !accessEmail) {
                        throw new Error("This confirmation link is incomplete.");
                    }

                    response = await fetchApi('/api/orders/track', {
                        method: "POST",
                        body: {
                            tracking_token: initialToken,
                            email: accessEmail,
                        },
                    });
                }

                const payload = await response.json();

                if (!response.ok || !payload?.data) {
                    throw new Error(payload?.message || "Unable to access this order.");
                }

                const trackedOrder = payload.data as TrackingOrder;
                if (trackedOrder.tracking_access_token) {
                    setTrackingToken(trackedOrder.tracking_access_token);
                }
                setOrder(trackedOrder);

                // Landed here inside the small PayPal popup (window.opener points back
                // at the checkout tab) — close automatically now that the order is
                // confirmed so the shopper doesn't have to close it by hand. The
                // checkout tab is polling for this and takes over showing the same
                // confirmation, matching the one-tab feel of the card/COD flow.
                if (gateway === "paypal" && typeof window !== "undefined" && window.opener && window.opener !== window) {
                    window.close();
                }
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to access this order.");
            } finally {
                setLoading(false);
            }
        };

        void loadOrder();
    }, [gateway, initialToken, queryEmail, sessionId]);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f6f7]">
                <Loader2 className="animate-spin text-rust" size={34} />
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-6">
                <div className="max-w-lg rounded-3xl border border-[#e8e8ea] bg-white p-10 text-center shadow-sm">
                    <Package className="mx-auto mb-5 text-rust" size={38} />
                    <h1 className="text-2xl font-semibold text-[#1a1a1a]">Order confirmation unavailable</h1>
                    <p className="mt-3 text-sm leading-6 text-[#6b6b70]">{error || "Unable to access this order."}</p>
                    <Link href="/track-order" className="mt-7 inline-flex rounded-lg bg-rust px-5 py-3 text-sm font-semibold text-white">
                        Open order tracking
                    </Link>
                </div>
            </main>
        );
    }

    const destination = [
        order.shipping_address.city,
        order.shipping_address.state,
        order.shipping_address.postcode,
        order.shipping_address.country,
    ].filter(Boolean).join(", ");

    const timeline = buildTimeline(order);
    const orderDate = order.created_at
        ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(order.created_at))
        : "—";

    return (
        <main className="min-h-screen bg-[#faf9f8] font-hanken">
            <Header />

            <div className="border-b border-[#ececef] bg-white">
                <div className="mx-auto max-w-[1120px] px-5 py-7 md:py-9">
                    <div className="flex items-center gap-4">
                        <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-[#fff3eb]">
                            <CheckCircle size={28} strokeWidth={2} className="text-[#df8448]" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#df8448]">Order #{order.reference}</p>
                            <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-[#2f3d46] md:text-[30px]">Thank you for your order!</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-8 md:py-10 lg:grid lg:grid-cols-[1fr_370px] lg:items-start lg:gap-8">
                <div className="order-last space-y-5 lg:order-first">
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Order progress</h2>
                        </div>
                        <div className="px-6 py-5">
                            <div className="space-y-5">
                                {timeline.map((step, index) => (
                                    <div key={step.key} className="relative flex gap-4">
                                        {index < timeline.length - 1 ? (
                                            <span className={`absolute left-[11px] top-6 h-[calc(100%+8px)] w-px ${step.done ? "bg-[#df8448]" : "bg-[#e5e7eb]"}`} />
                                        ) : null}
                                        <span className={`relative z-10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${step.done ? "border-[#df8448] bg-[#df8448] text-white" : "border-[#d1d5db] bg-white text-[#9ca3af]"}`}>
                                            {step.done ? <CheckCircle size={14} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                                        </span>
                                        <p className="pb-1 text-[13.5px] font-semibold text-[#1a1a1a]">{step.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {order.tracking_url ? (
                        <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                            <div className="border-b border-[#f3f3f5] px-6 py-4">
                                <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Shipment tracking</h2>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-6 py-5">
                                <div>
                                    <p className="text-[13.5px] font-medium text-[#555555]">{order.carrier ? formatStatus(order.carrier) : "Carrier"}</p>
                                    {order.tracking_number ? (
                                        <p className="mt-0.5 text-[12.5px] leading-[1.6] text-[#707070]">Tracking number: {order.tracking_number}</p>
                                    ) : null}
                                </div>
                                <a href={order.tracking_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#df8448] px-4 text-[12px] font-semibold text-[#df8448] transition hover:bg-[#fff4ec]">
                                    <Truck size={14} /> Open tracking
                                </a>
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Order details</h2>
                        </div>
                        <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Order number</p>
                                <p className="mt-1.5 text-[14px] font-semibold text-[#1a1a1a]">{order.reference}</p>
                            </div>
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Date</p>
                                <p className="mt-1.5 text-[14px] font-medium text-[#555555]">{orderDate}</p>
                            </div>
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Order total</p>
                                <p className="mt-1.5 text-[14px] font-semibold text-[#1a1a1a]">{formatMoney(order.total)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Shipping</h2>
                        </div>
                        <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                            <div className="px-6 py-5">
                                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Shipping method</p>
                                <p className="text-[13.5px] text-[#555555]">{order.shipping_method}</p>
                            </div>
                            <div className="px-6 py-5">
                                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Ships to</p>
                                <p className="text-[13.5px] text-[#555555]">{destination || "Not available"}</p>
                            </div>
                        </div>
                    </div>

                    {trackingToken && email ? (
                        <RetryPaymentPanel trackingToken={trackingToken} email={email} orderStatus={order.status} />
                    ) : null}

                    <div className="flex flex-col items-center gap-3 pb-8 pt-1 sm:flex-row lg:pb-0">
                        <Link href="/shop" className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[#df8448] px-8 text-[14px] font-semibold text-white transition-all hover:bg-[#c9713a] hover:shadow-md sm:w-auto">
                            Continue shopping
                        </Link>
                        <Link href={`/returns?token=${encodeURIComponent(trackingToken)}&email=${encodeURIComponent(email)}`} className="flex h-11 w-full items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white px-8 text-[14px] font-semibold text-[#555555] transition-all hover:bg-[#faf9f8] hover:shadow-sm sm:w-auto">
                            Request a return
                        </Link>
                    </div>
                </div>

                <aside className="order-first lg:order-last lg:mt-0">
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="divide-y divide-[#f3f3f5]">
                            {order.lines.map((line) => (
                                <div key={line.id} className="flex items-center gap-3.5 px-5 py-4">
                                    <div className="relative flex-shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={line.image ?? "/assets/product/Pug-Dog-Bed.webp"}
                                            alt=""
                                            width={64}
                                            height={64}
                                            className="h-16 w-16 rounded-[8px] border border-[#ececef] bg-[#faf9f8] object-contain p-1.5"
                                        />
                                        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-black text-[11px] font-bold leading-none text-white ring-2 ring-white">
                                            {line.quantity}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-medium leading-[1.5] text-[#1a1a1a]">{line.description}</p>
                                    </div>
                                    <p className="flex-shrink-0 text-[13px] font-semibold text-[#1a1a1a]">{formatMoney(line.sub_total)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2.5 border-t border-[#e8e8ea] px-5 py-5">
                            <div className="flex items-center justify-between text-[13px]">
                                <span className="text-[#707070]">Subtotal</span>
                                <span className="font-medium text-[#1a1a1a]">{formatMoney(order.sub_total)}</span>
                            </div>
                            {order.discount_total > 0 ? (
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-[#707070]">Discount</span>
                                    <span className="font-semibold text-[#df8448]">&minus;{formatMoney(order.discount_total)}</span>
                                </div>
                            ) : null}
                            <div className="flex items-center justify-between text-[13px]">
                                <span className="text-[#707070]">Shipping</span>
                                <span className="font-medium text-[#1a1a1a]">{order.shipping_total > 0 ? formatMoney(order.shipping_total) : "Free"}</span>
                            </div>
                            <div className="flex items-center justify-between text-[13px]">
                                <span className="text-[#707070]">Tax</span>
                                <span className="font-medium text-[#1a1a1a]">{formatMoney(order.tax_total)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between border-t border-[#e8e8ea] pt-4">
                                <span className="text-[14px] font-semibold text-[#1a1a1a]">Total</span>
                                <div className="text-right">
                                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">{order.currency}</p>
                                    <p className="text-[22px] font-bold tracking-tight text-[#1a1a1a]">{formatMoney(order.total)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}

export default function OrderSuccessPage() {
    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f6f6f7]" />}>
            <OrderSuccessContent />
        </Suspense>
    );
}
