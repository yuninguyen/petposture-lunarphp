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
};

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
