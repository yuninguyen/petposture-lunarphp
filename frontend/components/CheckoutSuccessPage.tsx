"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, Package, Truck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { fetchApi } from "@/lib/fetchApi";
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

    return (
        <main className="min-h-screen bg-[#f6f6f7] px-6 py-16">
            <div className="mx-auto max-w-3xl space-y-6">
                <section className="rounded-3xl border border-[#e8e8ea] bg-white p-8 shadow-sm md:p-10">
                    <CheckCircle className="mb-5 text-[#198754]" size={44} />
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#198754]">Order received</p>
                    <h1 className="mt-3 text-3xl font-semibold text-[#1a1a1a]">Thanks for your order.</h1>
                    <p className="mt-3 text-sm leading-6 text-[#6b6b70]">
                        Keep this private confirmation link. Your order reference is <strong>{order.reference}</strong>.
                    </p>
                </section>

                {order.lines.length > 0 ? (
                    <section className="rounded-3xl border border-[#e8e8ea] bg-white p-8 shadow-sm">
                        <p className="mb-5 text-xs font-bold uppercase tracking-wider text-[#8a8a90]">Order items</p>
                        <div className="divide-y divide-[#f1f1f3]">
                            {order.lines.map((line) => (
                                <div key={line.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={line.image ?? "/assets/product/Pug-Dog-Bed.webp"}
                                        alt=""
                                        width={56}
                                        height={56}
                                        className="h-14 w-14 flex-shrink-0 rounded-xl border border-[#ececec] object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#1a1a1a]">{line.description}</p>
                                        <p className="mt-0.5 text-sm text-[#8a8a90]">Qty {line.quantity}</p>
                                    </div>
                                    <p className="flex-shrink-0 text-sm font-semibold text-[#1a1a1a]">{formatMoney(line.sub_total)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 space-y-2 border-t border-[#f1f1f3] pt-5 text-sm">
                            <div className="flex justify-between text-[#6b6b70]">
                                <span>Subtotal</span>
                                <span>{formatMoney(order.sub_total)}</span>
                            </div>
                            {order.discount_total > 0 ? (
                                <div className="flex justify-between text-[#198754]">
                                    <span>Discount</span>
                                    <span>&minus;{formatMoney(order.discount_total)}</span>
                                </div>
                            ) : null}
                            <div className="flex justify-between text-[#6b6b70]">
                                <span>Shipping</span>
                                <span>{order.shipping_total > 0 ? formatMoney(order.shipping_total) : "Free"}</span>
                            </div>
                            <div className="flex justify-between text-[#6b6b70]">
                                <span>Taxes</span>
                                <span>{formatMoney(order.tax_total)}</span>
                            </div>
                            <div className="flex justify-between border-t border-[#f1f1f3] pt-2 text-base font-bold text-[#1a1a1a]">
                                <span>Total</span>
                                <span>{formatMoney(order.total)} <span className="text-xs font-normal text-[#8a8a90]">{order.currency}</span></span>
                            </div>
                        </div>
                    </section>
                ) : null}

                <section className="grid gap-4 rounded-3xl border border-[#e8e8ea] bg-white p-8 shadow-sm md:grid-cols-2">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#8a8a90]">Order status</p>
                        <p className="mt-2 font-semibold text-[#1a1a1a]">{formatStatus(order.status)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#8a8a90]">Fulfillment</p>
                        <p className="mt-2 font-semibold text-[#1a1a1a]">{formatStatus(order.fulfillment_status)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#8a8a90]">Carrier / ETA</p>
                        <p className="mt-2 font-semibold text-[#1a1a1a]">
                            {order.carrier ? formatStatus(order.carrier) : "Not assigned"} · {order.eta || "Pending update"}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#8a8a90]">Masked destination</p>
                        <p className="mt-2 font-semibold text-[#1a1a1a]">{destination || "Not available"}</p>
                    </div>
                    {order.tracking_url ? (
                        <a href={order.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-rust">
                            <Truck size={16} /> Open carrier tracking
                        </a>
                    ) : null}
                </section>

                {trackingToken && email ? (
                    <RetryPaymentPanel
                        trackingToken={trackingToken}
                        email={email}
                        orderStatus={order.status}
                    />
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <Link href={`/returns?token=${encodeURIComponent(trackingToken)}&email=${encodeURIComponent(email)}`} className="rounded-lg border border-[#d8d8dc] bg-white px-5 py-3 text-sm font-semibold text-[#333]">
                        Request a return
                    </Link>
                    <Link href="/" className="rounded-lg bg-rust px-5 py-3 text-sm font-semibold text-white">
                        Continue shopping
                    </Link>
                </div>
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
