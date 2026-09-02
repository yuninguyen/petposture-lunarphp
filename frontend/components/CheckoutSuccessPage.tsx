"use client";

import React, { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, CreditCard, Loader2, Mail, Package, ShoppingBag, Truck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { fetchApi } from "@/lib/fetchApi";
import { useCart } from "@/context/CartContext";
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
    customer_email: string | null;
    shipping_address: {
        first_name: string | null;
        last_name: string | null;
        line_one: string | null;
        line_two: string | null;
        city: string | null;
        state: string | null;
        postcode: string | null;
        country: string | null;
        phone: string | null;
    };
    billing_address: {
        first_name: string | null;
        last_name: string | null;
        line_one: string | null;
        line_two: string | null;
        city: string | null;
        state: string | null;
        postcode: string | null;
        country: string | null;
        phone: string | null;
    };
    payment_label: string | null;
    card_brand: string | null;
    card_last4: string | null;
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

function AddressBlock({ title, address }: { title: string; address: TrackingOrder["shipping_address"] }) {
    const name = `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim();
    const cityLine = [address.city, address.state, address.postcode].filter(Boolean).join(" ");

    return (
        <div className="px-6 py-5">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">{title}</p>
            <div className="space-y-0.5 text-[13.5px] leading-[1.8] text-[#555555]">
                {name ? <p className="font-semibold text-[#1a1a1a]">{name}</p> : null}
                {address.line_one ? <p>{address.line_one}</p> : null}
                {address.line_two ? <p>{address.line_two}</p> : null}
                {cityLine ? <p>{cityLine}</p> : null}
                {address.country ? <p>{address.country}</p> : null}
                {address.phone ? <p className="text-[#707070]">{address.phone}</p> : null}
            </div>
        </div>
    );
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
    const { items } = useCart();
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
            <main className="flex min-h-screen items-center justify-center bg-[#fcfcfd]">
                <Loader2 className="animate-spin text-rust" size={34} />
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#fcfcfd] px-6">
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

    const timeline = buildTimeline(order);
    const customerName = `${order.shipping_address.first_name ?? ""} ${order.shipping_address.last_name ?? ""}`.trim();
    const orderDate = order.created_at
        ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(order.created_at))
        : "—";

    const deliveredDone = timeline.find((step) => step.key === "delivered")?.done ?? false;

    return (
        <main className="min-h-screen bg-[#fcfcfd] font-hanken text-[#333333]">
            <div className="sticky top-0 z-40 border-b border-[#e8e8ea] bg-white">
                <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-3 lg:px-12 lg:py-4">
                    <Link href="/" className="flex items-center transition hover:opacity-80">
                        <Image
                            src="/assets/logo/Logo-PetPosture-1.webp"
                            alt="PetPosture Logo"
                            width={160}
                            height={80}
                            priority
                            className="h-9 w-auto object-contain lg:h-11"
                        />
                    </Link>
                    <Link href="/cart" className="relative flex items-center justify-center p-1 text-[#333333] transition hover:text-rust" aria-label="Shopping cart">
                        <ShoppingBag size={22} />
                        {items.length > 0 && (
                            <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-black text-ink shadow-sm">
                                {items.reduce((total, item) => total + item.quantity, 0)}
                            </span>
                        )}
                    </Link>
                </div>
            </div>

            <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col lg:flex-row">
                <div className="flex-1 border-r border-[#e8e8ea] bg-white px-4 pt-4 pb-8 md:px-8 lg:px-12 lg:pt-6 lg:pb-12">
                    <div className="flex items-center gap-4">
                        <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-[#fff3eb]">
                            <CheckCircle size={28} strokeWidth={2} className="text-[#df8448]" />
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-[#df8448]">Confirmation #{order.reference}</p>
                            <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-[#2f3d46] md:text-[30px]">Thank you{customerName ? `, ${customerName}` : ""}!</h1>
                        </div>
                    </div>

                    <div className="mt-6 rounded-[8px] border border-[#f0ddd0] bg-[#fff8f4] px-5 py-4">
                        <p className="flex items-start gap-2.5 text-[14px] leading-[1.65] text-[#7a4020]">
                            <Mail size={15} className="mt-0.5 flex-shrink-0 text-[#df8448]" />
                            <span>
                                <span className="font-semibold">Your order is confirmed</span><br />
                                You&apos;ll receive a confirmation email soon
                            </span>
                        </p>
                    </div>

                    <div className="mt-6 space-y-5">
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
                                            <div className="pb-1">
                                                <p className="text-[13.5px] font-semibold text-[#1a1a1a]">{step.label}</p>
                                                {step.key === "shipped" && step.done && order.tracking_url ? (
                                                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[8px] border border-[#e8e8ea] bg-[#faf9f8] px-3.5 py-3">
                                                        <div>
                                                            <p className="text-[12.5px] font-medium text-[#555555]">{order.carrier ? formatStatus(order.carrier) : "Carrier"}</p>
                                                            {order.tracking_number ? (
                                                                <p className="mt-0.5 text-[12px] leading-[1.6] text-[#707070]">Tracking number: {order.tracking_number}</p>
                                                            ) : null}
                                                        </div>
                                                        <a href={order.tracking_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[#df8448] px-3.5 text-[12px] font-semibold text-[#df8448] transition hover:bg-[#fff4ec]">
                                                            <Truck size={14} /> Open tracking
                                                        </a>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                            <div className="border-b border-[#f3f3f5] px-6 py-4">
                                <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Order details</h2>
                            </div>
                            <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                <div className="px-6 py-5">
                                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">Contact information</p>
                                    <p className="text-[13.5px] text-[#555555]">{order.customer_email || "Not available"}</p>
                                </div>
                                <div className="px-6 py-5">
                                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">Date</p>
                                    <p className="text-[13.5px] text-[#555555]">{orderDate}</p>
                                </div>
                            </div>
                            <div className="grid divide-y divide-[#f3f3f5] border-t border-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                <div className="px-6 py-5">
                                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">Shipping method</p>
                                    <p className="text-[13.5px] text-[#555555]">{order.shipping_method}</p>
                                </div>
                                <div className="px-6 py-5">
                                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">Payment method</p>
                                    <div className="flex items-center gap-2">
                                        {order.card_brand ? (
                                            <span className="flex h-7 w-10 flex-shrink-0 items-center justify-center rounded-[4px] border border-[#e8e8ea] bg-[#faf9f8]">
                                                <CreditCard size={14} className="text-[#9ca3af]" />
                                            </span>
                                        ) : null}
                                        <p className="text-[13.5px] text-[#555555]">
                                            {order.card_brand ? `${formatStatus(order.card_brand)} •••• ${order.card_last4}` : (order.payment_label || "—")}
                                            {" — "}{formatMoney(order.total)} <span className="text-[11px] text-[#9ca3af]">{order.currency}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid divide-y divide-[#f3f3f5] border-t border-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                <AddressBlock title="Shipping address" address={order.shipping_address} />
                                <AddressBlock title="Billing address" address={order.billing_address} />
                            </div>
                        </div>

                        {trackingToken && email ? (
                            <RetryPaymentPanel trackingToken={trackingToken} email={email} orderStatus={order.status} />
                        ) : null}

                        <div className="flex flex-col items-center gap-3 pb-2 pt-1 sm:flex-row">
                            <Link href="/shop" className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[#df8448] px-8 text-[14px] font-semibold text-white transition-all hover:bg-[#c9713a] hover:shadow-md sm:w-auto">
                                Continue shopping
                            </Link>
                            {deliveredDone ? (
                                <Link href={`/returns?token=${encodeURIComponent(trackingToken)}&email=${encodeURIComponent(email)}`} className="flex h-11 w-full items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white px-8 text-[14px] font-semibold text-[#555555] transition-all hover:bg-[#faf9f8] hover:shadow-sm sm:w-auto">
                                    Request a return
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </div>

                <aside className="order-first w-full border-b border-[#e8e8ea] bg-[#fafafa] px-4 py-6 md:px-8 lg:order-last lg:w-[440px] lg:border-b-0 lg:border-l lg:px-10 lg:py-12">
                    <div className="lg:sticky lg:top-12">
                        <div className="divide-y divide-[#f3f3f5] rounded-[10px] border border-[#e8e8ea] bg-white">
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

                            <div className="space-y-2.5 px-5 py-5">
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
                                    <span className="text-[#707070]">Estimated taxes</span>
                                    <span className="font-medium text-[#1a1a1a]">{formatMoney(order.tax_total)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between border-t border-[#e8e8ea] pt-4">
                                    <span className="text-[14px] font-semibold text-[#1a1a1a]">Total</span>
                                    <p className="flex items-baseline gap-1.5 text-[18px] font-bold tracking-tight text-[#1a1a1a]">
                                        <span className="text-[11px] font-semibold text-[#9ca3af]">{order.currency}</span>
                                        {formatMoney(order.total)}
                                    </p>
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
