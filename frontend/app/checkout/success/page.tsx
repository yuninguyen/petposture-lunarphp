"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
    CheckCircle,
    Package,
    Mail,
    CreditCard,
    Truck,
    Tag,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import RetryPaymentPanel from "@/components/orders/RetryPaymentPanel";

/* ─────────────────────────── Types ─────────────────────────── */
interface OrderLine {
    id: number;
    description: string;
    quantity: number;
    unit_price: string;
    sub_total: string;
    image: string | null;
}

interface Address {
    first_name: string;
    last_name: string;
    line_one: string;
    line_two: string | null;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string | null;
}

interface OrderData {
    reference: string;
    status: string;
    status_label: string;
    payment_status: string;
    payment_status_label: string;
    payment_label?: string | null;
    payment_intent_status?: string | null;
    payment_last_event_type?: string | null;
    payment_instructions?: string | null;
    payment_received_at?: string | null;
    processing_started_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
    order_events?: Array<{
        type: string;
        title: string;
        detail?: string | null;
        created_at: string;
    }>;
    shipments?: Array<{
        id: string;
        tracking_number: string;
        carrier?: string | null;
        tracking_url?: string | null;
        status: string;
    }>;
    customer_email: string;
    shipping_method: string | null;
    payment_method: string | null;
    total: { formatted: string; decimal: number; currency: string };
    sub_total: string;
    tax_total: string;
    shipping_total: string;
    discount_total: string;
    created_at: string;
    notes: string | null;
    lines: OrderLine[];
    shipping_address: Address;
    billing_address: Address;
    coupon_code?: string | null;
    tax_rate_percentage?: number;
    tax_state_rate_percentage?: number;
    tax_avg_local_rate_percentage?: number;
    tax_provider?: string | null;
    tax_is_estimate?: boolean;
    tax_source_label?: string | null;
    tax_source_url?: string | null;
    tax_effective_date?: string | null;
}

/* ─────────────────────────── Helpers ───────────────────────── */
function formatMethodLabel(value: string) {
    return value
        .replace(/[_-]/g, " ")
        .replace(/\bcod\b/i, "Cash on delivery")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function paymentTone(status?: string | null) {
    switch (status) {
        case "paid":
            return "bg-[#eef8f0] text-[#1f7a3d]";
        case "processing":
        case "pending":
            return "bg-[#eef4ff] text-[#2457c5]";
        case "failed":
        case "cancelled":
            return "bg-[#fff1f1] text-[#c03d3d]";
        default:
            return "bg-[#fff3eb] text-[#df8448]";
    }
}

function paymentMessage(order: OrderData) {
    if (order.payment_status === "paid") {
        return "Your payment has been confirmed.";
    }

    if (order.payment_status === "processing" || order.payment_intent_status === "processing") {
        return "Your payment is processing. We'll update you as soon as it clears.";
    }

    if (order.payment_status === "failed") {
        return "Your payment did not go through. Please contact support if you need help.";
    }

    if (order.payment_method === "cod") {
        return order.payment_instructions || "You'll pay when your order is delivered.";
    }

    return "We're waiting for payment confirmation before fulfillment begins.";
}

function buildOrderTimeline(order: OrderData) {
    const formatTimelineTime = (value?: string | null) =>
        value
            ? new Intl.DateTimeFormat("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }).format(new Date(value))
            : null;

    const steps = [
        {
            key: "created",
            label: "Order placed",
            detail: formatTimelineTime(order.created_at),
            done: true,
        },
        {
            key: "payment",
            label: order.payment_status === "paid" ? "Payment confirmed" : "Payment review",
            detail: formatTimelineTime(order.payment_received_at) || paymentMessage(order),
            done: Boolean(order.payment_received_at) || order.payment_status === "paid",
        },
        {
            key: "processing",
            label: "Preparing your order",
            detail: formatTimelineTime(order.processing_started_at) || "We're reviewing and packing your items for shipment.",
            done: Boolean(order.processing_started_at) || ["processing", "shipped", "delivered"].includes(order.status),
        },
        {
            key: "shipping",
            label: "Shipment in transit",
            detail: formatTimelineTime(order.shipped_at) || "You'll receive another update when your package is on the way.",
            done: Boolean(order.shipped_at) || ["shipped", "delivered"].includes(order.status),
        },
    ];

    if (order.status === "delivered" || order.delivered_at) {
        steps.push({
            key: "delivered",
            label: "Delivered",
            detail: formatTimelineTime(order.delivered_at) || "Your order has been delivered.",
            done: true,
        });
    }

    if (order.cancelled_at) {
        steps.push({
            key: "cancelled",
            label: "Order cancelled",
            detail: formatTimelineTime(order.cancelled_at),
            done: true,
        });
    }

    return steps;
}

function latestShipment(order: OrderData) {
    return order.shipments?.[order.shipments.length - 1] ?? null;
}

/** Strip placeholder city/state/postcode values */
function isPlaceholder(val?: string | null) {
    if (!val) return true;
    return /^(anytown|any town|n\/a|na|test|unknown|\d{5}|00000|12345)$/i.test(val.trim());
}

/**
 * Detect whether line_one already contains the full address
 * (LunarPHP sometimes serialises address into line_one).
 * We check if line_one includes the first_name to identify this case.
 */
function lineOneIsFullAddress(address: Address): boolean {
    const name = address.first_name?.trim();
    return Boolean(name && address.line_one?.includes(name));
}

/* ─────────────────────────── Address Block ─────────────────── */
function AddressBlock({ title, address }: { title: string; address: Address }) {
    const rawParts = [
        address.first_name,
        address.last_name,
        address.line_one,
        address.line_two,
    ].filter(Boolean).map(s => s!.trim());

    // Prevent duplicate merging if the backend stuffed the exact same string or a substring 
    // into multiple fields (e.g. line_one contains first_name).
    const uniqueParts = rawParts.filter(
        (part, idx) => !rawParts.some((other, otherIdx) => idx !== otherIdx && other.includes(part))
    );

    const fullCombinedString = uniqueParts
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    let name = "";
    let street = "";
    let cityLine = "";
    let country = address.country && !isPlaceholder(address.country) ? address.country.trim() : "";
    let phone = address.phone?.trim() || "";

    const isPacked =
        isPlaceholder(address.city) ||
        lineOneIsFullAddress(address) ||
        /Phone:|Ph:|Tel:/i.test(fullCombinedString);

    if (isPacked) {
        let raw = fullCombinedString;

        // 1. Phone
        const phoneMatch = raw.match(/(?:Phone:|Ph:|Tel:)?\s*(\d[\d\s\-\(\)]{6,})/i);
        if (phoneMatch) {
            phone = phoneMatch[1].trim();
            raw = raw.replace(phoneMatch[0], "").trim();
        }

        // 2. Country
        const countryMatch = raw.match(/(United States|Vietnam|Canada|Australia|Singapore)$/i);
        if (countryMatch) {
            country = countryMatch[1].trim();
            raw = raw.slice(0, countryMatch.index).replace(/,+$/, "").trim();
        } else if (address.country && !isPlaceholder(address.country)) {
            country = address.country.trim();
        }

        // 3. Zip and State
        let zip = "";
        let state = "";
        const stateZipMatch = raw.match(/[,\s]+([A-Z]{2})[,\s]+(\d{5})$/i);
        if (stateZipMatch) {
            state = stateZipMatch[1].toUpperCase();
            zip = stateZipMatch[2];
            raw = raw.slice(0, stateZipMatch.index).trim();
        }

        // 4. City
        const parts = raw.split(',');
        if (parts.length > 1) {
            const city = parts.pop()!.trim();
            raw = parts.join(',').trim();
            cityLine = [city, state, zip].filter(Boolean).join(' ');
        } else {
            // No comma separation. Walk backward from the end words.
            const words = raw.split(' ');
            const streetSuffixes = new Set([
                "ave", "avenue", "st", "street", "rd", "road", "blvd", "boulevard",
                "ln", "lane", "dr", "drive", "way", "ct", "court", "pl", "place",
                "sq", "square", "trl", "trail", "pkwy", "parkway", "cir", "circle",
                "highway", "hwy", "broadway", "pike", "pass", "crossing", "xing", "cove"
            ]);

            const cityWords: string[] = [];
            while (words.length > 0) {
                const lastWord = words[words.length - 1];
                const lowerLast = lastWord.toLowerCase().replace(/[^a-z]/g, '');

                // Stop if we hit a street suffix and we already have some city words
                if (streetSuffixes.has(lowerLast) && cityWords.length > 0) {
                    break;
                }
                if (words.length === 1) break; // Don't consume everything

                cityWords.unshift(words.pop() as string);
                if (cityWords.length >= 3) break; // reasonable max for city names
            }
            const city = cityWords.join(' ');
            raw = words.join(' ').trim();
            cityLine = [city, state, zip].filter(Boolean).join(' ');
        }

        // 5. Name & Street
        const streetMatch = raw.match(/\b\d+\s+.*$/);
        if (streetMatch) {
            street = streetMatch[0].replace(/,+$/, "").trim();
            name = raw.slice(0, streetMatch.index).replace(/,+$/, "").trim();
        } else {
            name = raw;
        }
    } else {
        /* ── Structured fields fallback ── */
        name = `${address.first_name || ""} ${address.last_name || ""}`.trim();
        street = [address.line_one, address.line_two].filter(Boolean).join(", ");

        const city = !isPlaceholder(address.city) ? address.city : "";
        const state = !isPlaceholder(address.state) ? address.state : "";
        const zip = !isPlaceholder(address.postcode) ? address.postcode : "";
        cityLine = [city, state, zip].filter(Boolean).join(" ");

        country = address.country && !isPlaceholder(address.country) ? address.country : "";
    }

    return (
        <div>
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                {title}
            </p>
            <div className="space-y-0.5 text-[13.5px] leading-[1.8] text-[#555555]">
                {name && <p className="font-semibold text-[#1a1a1a]">{name}</p>}
                {street && <p>{street}</p>}
                {cityLine && <p>{cityLine}</p>}
                {country && <p>{country}</p>}
                {phone && <p className="text-[#707070]">{phone}</p>}
            </div>
        </div>
    );
}

/* ─────────────────────────── Main Content ──────────────────── */
function OrderSuccessContent() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("ref");
    const email = searchParams.get("email");

    const [order, setOrder] = useState<OrderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!reference || !email) {
                setError("Missing order reference or email.");
                setLoading(false);
                return;
            }
            try {
                const apiBase = getApiBaseUrl();
                const res = await fetch(`${apiBase}/api/orders/track`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tracking_number: reference, email }),
                });
                const raw = await res.text();
                const data = raw ? JSON.parse(raw) : null;
                if (res.ok) {
                    setOrder(data.data);
                } else {
                    setError(data?.message || "Failed to fetch order details.");
                }
            } catch (err) {
                console.error(err);
                setError("Network error fetching order details.");
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [reference, email]);

    /* Loading */
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#faf9f8]">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#df8448] border-t-transparent" />
            </div>
        );
    }

    /* Error */
    if (error || !order) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#faf9f8] px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff3eb]">
                    <Package size={26} className="text-[#df8448]" />
                </div>
                <h1 className="text-[22px] font-semibold text-[#1a1a1a]">
                    Order not found
                </h1>
                <p className="max-w-[400px] text-[14px] text-[#707070]">
                    {error || "We couldn't locate your order. Please check your email for details."}
                </p>
                <Link
                    href="/shop"
                    className="mt-2 inline-flex h-11 items-center justify-center rounded-[6px] bg-[#df8448] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#c9713a]"
                >
                    Return to shop
                </Link>
            </div>
        );
    }

    const shippingMethod = formatMethodLabel(order.shipping_method || "standard");
    const paymentMethod = formatMethodLabel(order.payment_label || order.payment_method || "card");
    const productLines = order.lines.filter((l) => l.quantity > 0);
    const orderTotal = order.total.decimal.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const timeline = buildOrderTimeline(order);
    const recentEvents = [...(order.order_events || [])].reverse().slice(0, 4);
    const shipment = latestShipment(order);

    return (
        <main className="min-h-screen bg-[#faf9f8] font-hanken">

            {/* ── Site header ── */}
            <header className="border-b border-[#ececef] bg-white">
                <div className="mx-auto max-w-[1120px] px-5 pt-4 lg:pt-6 relative h-16">
                    <Link href="/" className="flex-shrink-0 relative w-[240px] h-full flex items-center -ml-2 transition hover:opacity-80">
                        <Image
                            src="/assets/Logo-PetPosture-1.png"
                            alt="PetPosture Logo"
                            width={300}
                            height={150}
                            priority
                            className="absolute top-1/2 -translate-y-[56%] left-0 h-[120px] md:h-[130px] w-auto object-contain z-50 drop-shadow-sm"
                        />
                    </Link>
                </div>
            </header>

            {/* ── Confirmation banner ── */}
            <div className="bg-white border-b border-[#ececef]">
                <div className="mx-auto max-w-[1120px] px-5 py-7 md:py-9">
                    <div className="flex items-center gap-4">
                        <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-[#fff3eb]">
                            <CheckCircle
                                size={28}
                                strokeWidth={2}
                                className="text-[#df8448]"
                            />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#df8448]">
                                Order #{order.reference}
                            </p>
                            <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-[#2f3d46] md:text-[30px]">
                                Thank you, {order.shipping_address.first_name}!
                            </h1>
                        </div>
                    </div>

                    {/* Email confirmation notice */}
                    <div className="mt-6 rounded-[8px] border border-[#f0ddd0] bg-[#fff8f4] px-5 py-4">
                        <p className="flex items-start gap-2.5 text-[14px] leading-[1.65] text-[#7a4020]">
                            <Mail
                                size={15}
                                className="mt-0.5 flex-shrink-0 text-[#df8448]"
                            />
                            <span>
                                Your order is confirmed. We&apos;ve sent a confirmation email to{" "}
                                <span className="font-semibold">{order.customer_email}</span>{" "}
                                and will notify you when it&apos;s on its way.
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Two‑column body ── */}
            <div className="mx-auto max-w-[1120px] px-5 py-8 md:py-10 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_370px] lg:items-start lg:gap-8">

                {/* ── Left column ── */}
                <div className="space-y-5 order-last lg:order-first">

                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                Order progress
                            </h2>
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
                                            <p className="text-[13.5px] font-semibold text-[#1a1a1a]">
                                                {step.label}
                                            </p>
                                            <p className="mt-0.5 text-[12.5px] leading-[1.65] text-[#707070]">
                                                {step.detail}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {shipment?.tracking_url ? (
                        <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                            <div className="border-b border-[#f3f3f5] px-6 py-4">
                                <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                    Shipment tracking
                                </h2>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-6 py-5">
                                <div>
                                    <p className="text-[13.5px] font-medium text-[#555555]">
                                        {formatMethodLabel(shipment.carrier || "manual")}
                                    </p>
                                    <p className="mt-0.5 text-[12.5px] leading-[1.6] text-[#707070]">
                                        Tracking number: {shipment.tracking_number}
                                    </p>
                                </div>
                                <a
                                    href={shipment.tracking_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#df8448] px-4 text-[12px] font-semibold text-[#df8448] transition hover:bg-[#fff4ec]"
                                >
                                    Open tracking
                                </a>
                            </div>
                        </div>
                    ) : null}

                    {/* Order details */}
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                Order details
                            </h2>
                        </div>
                        <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                    Order number
                                </p>
                                <p className="mt-1.5 text-[14px] font-semibold text-[#1a1a1a]">
                                    {order.reference}
                                </p>
                            </div>
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                    Date
                                </p>
                                <p className="mt-1.5 text-[14px] font-medium text-[#555555]">
                                    {new Intl.DateTimeFormat("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    }).format(new Date(order.created_at))}
                                </p>
                            </div>
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                    Order total
                                </p>
                                <p className="mt-1.5 text-[14px] font-semibold text-[#1a1a1a]">
                                    ${orderTotal}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer info */}
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                Customer information
                            </h2>
                        </div>
                        <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                            <div className="px-6 py-5">
                                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                    <Mail size={12} />
                                    Contact
                                </p>
                                <p className="text-[13.5px] text-[#555555]">
                                    {order.customer_email}
                                </p>
                            </div>
                            <div className="px-6 py-5">
                                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                    <Truck size={12} />
                                    Shipping method
                                </p>
                                <p className="text-[13.5px] text-[#555555]">
                                    {shippingMethod}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                Shipping &amp; billing
                            </h2>
                        </div>
                        <div className="grid divide-y divide-[#f3f3f5] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                            <div className="px-6 py-5">
                                <AddressBlock title="Shipping address" address={order.shipping_address} />
                            </div>
                            <div className="px-6 py-5">
                                <AddressBlock title="Billing address" address={order.billing_address} />
                            </div>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        <div className="border-b border-[#f3f3f5] px-6 py-4">
                            <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                Payment
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-5">
                            <div className="flex h-8 w-12 items-center justify-center rounded-[5px] border border-[#e8e8ea] bg-[#faf9f8]">
                                <CreditCard size={16} className="text-[#9ca3af]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13.5px] font-medium text-[#555555]">
                                    {paymentMethod}
                                </p>
                                <p className="mt-0.5 text-[12.5px] leading-[1.6] text-[#707070]">
                                    {paymentMessage(order)}
                                </p>
                            </div>
                            <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${paymentTone(order.payment_status)}`}>
                                {order.payment_status_label}
                            </span>
                        </div>
                    </div>

                    {recentEvents.length > 0 ? (
                        <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                            <div className="border-b border-[#f3f3f5] px-6 py-4">
                                <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                                    Recent updates
                                </h2>
                            </div>
                            <div className="space-y-3 px-6 py-5">
                                {recentEvents.map((event, index) => (
                                    <div key={`${event.type}-${event.created_at}-${index}`} className="rounded-[8px] border border-[#f1f2f4] bg-[#faf9f8] px-4 py-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[13px] font-medium text-[#1a1a1a]">
                                                    {event.title}
                                                </p>
                                                {event.detail ? (
                                                    <p className="mt-1 text-[12.5px] leading-[1.65] text-[#707070]">
                                                        {event.detail}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
                                                {new Date(event.created_at).toLocaleString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <RetryPaymentPanel
                        reference={order.reference}
                        email={order.customer_email}
                        customerName={`${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim()}
                        paymentMethod={order.payment_method}
                        paymentStatus={order.payment_status}
                        orderStatus={order.status}
                        onCompleted={() => window.location.reload()}
                    />

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pb-8 pt-1 lg:pb-0">
                        <Link
                            href="/shop"
                            className="flex h-11 w-full sm:w-auto items-center justify-center rounded-[6px] bg-[#df8448] px-8 text-[14px] font-semibold text-white transition-all hover:bg-[#c9713a] hover:shadow-md"
                        >
                            Continue shopping
                        </Link>
                        <Link
                            href="/"
                            className="flex h-11 w-full sm:w-auto items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white px-8 text-[14px] font-semibold text-[#555555] transition-all hover:bg-[#faf9f8] hover:shadow-sm"
                        >
                            Back to home
                        </Link>
                    </div>
                </div>

                {/* ── Right column: order summary ── */}
                <aside className="order-first lg:order-last lg:mt-0">
                    <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
                        {/* Products */}
                        <div className="divide-y divide-[#f3f3f5]">
                            {productLines.map((line) => (
                                <div
                                    key={line.id}
                                    className="flex items-center gap-3.5 px-5 py-4"
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className="relative flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-[8px] border border-[#ececef] bg-[#faf9f8]">
                                            {line.image ? (
                                                <Image
                                                    src={line.image}
                                                    alt={line.description}
                                                    fill
                                                    sizes="64px"
                                                    className="object-contain p-1.5"
                                                />
                                            ) : (
                                                <Package size={20} className="text-[#c8c8cc]" />
                                            )}
                                        </div>
                                        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-black text-[11px] font-bold leading-none text-white ring-2 ring-white">
                                            {line.quantity}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-[13px] font-medium leading-[1.5] text-[#1a1a1a]">
                                            {line.description}
                                        </p>
                                    </div>
                                    <p className="flex-shrink-0 text-[13px] font-semibold text-[#1a1a1a]">
                                        ${line.sub_total}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Totals */}
                        <div className="space-y-2.5 border-t border-[#e8e8ea] px-5 py-5">
                            <div className="flex items-center justify-between text-[13px]">
                                <span className="text-[#707070]">Subtotal</span>
                                <span className="font-medium text-[#1a1a1a]">
                                    ${order.sub_total}
                                </span>
                            </div>

                            {parseFloat(order.discount_total) > 0 && (
                                <div className="flex items-center justify-between text-[13px]">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-3.5 h-3.5 text-[#df8448]" />
                                        <span className="text-[#707070]">
                                            Discount {order.coupon_code && <span className="uppercase font-medium text-[#1a1a1a]">({order.coupon_code})</span>}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-[#df8448]">
                                        −${order.discount_total}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-[13px]">
                                <span className="text-[#707070]">Shipping</span>
                                <span className="font-medium text-[#1a1a1a]">
                                    {parseFloat(order.shipping_total) === 0
                                        ? "Free"
                                        : `$${order.shipping_total}`}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-[13px]">
                                <div className="pr-3 text-[#707070]">
                                    <span>
                                        {order.tax_is_estimate === false ? 'Tax' : 'Estimated tax'} {order.tax_rate_percentage !== undefined && order.tax_rate_percentage > 0 && (
                                            <span>({order.tax_rate_percentage}%)</span>
                                        )}
                                    </span>
                                    {order.tax_source_label ? (
                                        <p className="mt-1 text-[11px] leading-4 text-[#9ca3af]">
                                            {order.tax_source_label}
                                            {order.tax_effective_date ? `, effective ${order.tax_effective_date}` : ''}
                                        </p>
                                    ) : null}
                                </div>
                                <span className="font-medium text-[#1a1a1a]">
                                    ${order.tax_total}
                                </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between border-t border-[#e8e8ea] pt-4">
                                <span className="text-[14px] font-semibold text-[#1a1a1a]">
                                    Total
                                </span>
                                <div className="text-right">
                                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                                        {order.total.currency}
                                    </p>
                                    <p className="text-[22px] font-bold tracking-tight text-[#1a1a1a]">
                                        ${orderTotal}
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

/* ─────────────────────────── Export ────────────────────────── */
export default function OrderSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#faf9f8]">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#df8448] border-t-transparent" />
                </div>
            }
        >
            <OrderSuccessContent />
        </Suspense>
    );
}
