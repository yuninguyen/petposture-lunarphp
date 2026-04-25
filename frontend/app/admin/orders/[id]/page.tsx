"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, CreditCard, Mail, MapPin, Package, Truck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";

const shipmentCarrierOptions = [
    { value: "manual", label: "Manual" },
    { value: "ups", label: "UPS" },
    { value: "usps", label: "USPS" },
    { value: "fedex", label: "FedEx" },
    { value: "dhl", label: "DHL" },
];

type OrderAddress = {
    first_name: string | null;
    last_name: string | null;
    line_one: string | null;
    line_two: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
    phone?: string | null;
};

type OrderLine = {
    id: number;
    type?: string;
    description: string;
    quantity: number;
    unit_price: string;
    sub_total: string;
    image: string | null;
};

type OrderDetail = {
    id: string;
    reference: string;
    status: string;
    status_label: string;
    payment_status: string;
    payment_status_label: string;
    fulfillment_status: string;
    fulfillment_status_label: string;
    customer_email: string;
    shipping_method: string | null;
    shipping_label: string;
    payment_method: string | null;
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
        created_at?: string | null;
        shipped_at?: string | null;
        delivered_at?: string | null;
        updated_at?: string | null;
    }>;
    tracking_number: string;
    available_actions?: Array<{
        action: string;
        target_status: string;
        label: string;
    }>;
    customer_note: string | null;
    internal_note: string | null;
    total: { formatted: string; decimal: number; currency: string };
    sub_total: string;
    tax_total: string;
    shipping_total: string;
    discount_total: string;
    created_at: string;
    notes: string | null;
    lines: OrderLine[];
    shipping_address: OrderAddress;
    billing_address: OrderAddress;
};

function formatMethodLabel(value: string | null, fallback: string) {
    return (value || fallback)
        .replace(/[_-]/g, " ")
        .replace(/\bcod\b/i, "Cash on delivery")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAddress(address: OrderAddress) {
    return [
        [address.first_name, address.last_name].filter(Boolean).join(" ").trim(),
        address.line_one,
        address.line_two,
        [address.city, address.state, address.postcode].filter(Boolean).join(", ").trim(),
        address.country,
    ].filter(Boolean).join(", ");
}

function StatusPill({ label, tone }: { label: string; tone: "amber" | "green" | "blue" | "zinc" }) {
    const tones = {
        amber: "bg-yellow-100 text-yellow-800",
        green: "bg-green-100 text-green-800",
        blue: "bg-blue-100 text-blue-800",
        zinc: "bg-zinc-100 text-zinc-700",
    };

    return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tones[tone]}`}>{label}</span>;
}

function paymentStateMessage(order: OrderDetail) {
    if (order.payment_status === "paid") {
        return "Payment confirmed and synced to the order.";
    }

    if (order.payment_status === "processing" || order.payment_intent_status === "processing") {
        return "Stripe is still processing this payment.";
    }

    if (order.payment_status === "failed") {
        return "Payment failed. Review gateway response before fulfillment.";
    }

    if (order.payment_method === "cod") {
        return order.payment_instructions || "Cash will be collected on delivery.";
    }

    return "Awaiting successful payment confirmation.";
}

function buildAdminTimeline(order: OrderDetail) {
    const formatTimestamp = (value?: string | null) =>
        value ? new Date(value).toLocaleString() : null;

    return [
        {
            key: "created",
            label: "Order created",
            detail: formatTimestamp(order.created_at),
            done: true,
        },
        {
            key: "payment",
            label: order.payment_status_label,
            detail: formatTimestamp(order.payment_received_at) || paymentStateMessage(order),
            done: Boolean(order.payment_received_at) || ["paid", "pending", "processing"].includes(order.payment_status),
        },
        {
            key: "fulfillment",
            label: order.fulfillment_status_label,
            detail:
                formatTimestamp(order.delivered_at)
                || formatTimestamp(order.shipped_at)
                || formatTimestamp(order.processing_started_at)
                || (order.fulfillment_status === "shipped"
                    ? "Order left the warehouse."
                    : order.fulfillment_status === "delivered"
                        ? "Order marked as delivered."
                        : order.fulfillment_status === "processing"
                            ? "Ops team is preparing this shipment."
                            : "Order has not been fulfilled yet."),
            done: Boolean(order.processing_started_at || order.shipped_at || order.delivered_at) || order.fulfillment_status !== "unfulfilled",
        },
    ];
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [isCreatingShipment, setIsCreatingShipment] = useState(false);
    const [shipmentMessage, setShipmentMessage] = useState<string | null>(null);
    const [shipmentError, setShipmentError] = useState<string | null>(null);
    const [operationsForm, setOperationsForm] = useState({
        status: "",
        tracking_number: "",
        shipment_carrier: "",
        shipment_tracking_url: "",
        internal_note: "",
    });
    const [newShipmentForm, setNewShipmentForm] = useState({
        tracking_number: "",
        shipment_carrier: "manual",
        shipment_tracking_url: "",
    });

    useEffect(() => {
        let cancelled = false;

        const loadParamsAndOrder = async () => {
            try {
                const resolved = await params;

                if (cancelled) {
                    return;
                }

                setOrderId(resolved.id);

                const apiBase = getApiBaseUrl();
                const res = await fetch(`${apiBase}/api/orders/${resolved.id}`, {
                    credentials: "include",
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.message || "Failed to load order.");
                }

                if (!cancelled) {
                    const nextOrder = data.data ?? data;
                    setOrder(nextOrder);
                    setOperationsForm({
                        status: nextOrder.status || "",
                        tracking_number: nextOrder.tracking_number || "",
                        shipment_carrier: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.carrier || "",
                        shipment_tracking_url: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.tracking_url || "",
                        internal_note: nextOrder.internal_note || "",
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load order.");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadParamsAndOrder();

        return () => {
            cancelled = true;
        };
    }, [params]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#f4f6f8] font-hanken">
                <Header />
                <div className="mx-auto flex min-h-[60vh] max-w-[1200px] items-center justify-center px-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#df8448] border-t-transparent" />
                </div>
                <Footer />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#f4f6f8] font-hanken">
                <Header />
                <div className="mx-auto max-w-[1200px] px-4 py-16">
                    <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#df8448]">
                        <ArrowLeft size={14} /> Back to orders
                    </Link>
                    <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                        <h1 className="text-[24px] font-bold text-[#3e4c57]">Order not found</h1>
                        <p className="mt-3 text-[14px] text-zinc-500">{error || "We could not load this order."}</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const productLines = order.lines.filter((line) => line.type !== "shipping");
    const timeline = buildAdminTimeline(order);
    const orderEvents = [...(order.order_events || [])].reverse();

    const handleSaveOperations = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!orderId) {
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);
        setSaveError(null);

        try {
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/orders/${orderId}`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(operationsForm),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || "Failed to update order.");
            }

            const nextOrder = data.data ?? data;
            setOrder(nextOrder);
            setOperationsForm({
                status: nextOrder.status || "",
                tracking_number: nextOrder.tracking_number || "",
                shipment_carrier: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.carrier || "",
                shipment_tracking_url: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.tracking_url || "",
                internal_note: nextOrder.internal_note || "",
            });
            setSaveMessage("Order operations updated.");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to update order.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunAction = async (action: string) => {
        if (!orderId) {
            return;
        }

        setActiveAction(action);
        setSaveMessage(null);
        setSaveError(null);

        try {
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/orders/${orderId}/actions/${action}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tracking_number: operationsForm.tracking_number,
                    shipment_carrier: operationsForm.shipment_carrier,
                    shipment_tracking_url: operationsForm.shipment_tracking_url,
                    internal_note: operationsForm.internal_note,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || data?.errors?.status?.[0] || "Failed to run order action.");
            }

            const nextOrder = data.data ?? data;
            setOrder(nextOrder);
            setOperationsForm({
                status: nextOrder.status || "",
                tracking_number: nextOrder.tracking_number || "",
                shipment_carrier: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.carrier || "",
                shipment_tracking_url: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.tracking_url || "",
                internal_note: nextOrder.internal_note || "",
            });
            setSaveMessage("Order status updated.");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to run order action.");
        } finally {
            setActiveAction(null);
        }
    };

    const handleCreateShipment = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!orderId) {
            return;
        }

        setIsCreatingShipment(true);
        setShipmentMessage(null);
        setShipmentError(null);

        try {
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/orders/${orderId}/shipments`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newShipmentForm),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || data?.errors?.tracking_number?.[0] || "Failed to create shipment.");
            }

            const nextOrder = data.data ?? data;
            setOrder(nextOrder);
            setOperationsForm((current) => ({
                ...current,
                tracking_number: nextOrder.tracking_number || current.tracking_number,
                shipment_carrier: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.carrier || current.shipment_carrier,
                shipment_tracking_url: nextOrder.shipments?.[nextOrder.shipments.length - 1]?.tracking_url || current.shipment_tracking_url,
            }));
            setNewShipmentForm({
                tracking_number: "",
                shipment_carrier: "manual",
                shipment_tracking_url: "",
            });
            setShipmentMessage("Shipment created.");
        } catch (err) {
            setShipmentError(err instanceof Error ? err.message : "Failed to create shipment.");
        } finally {
            setIsCreatingShipment(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <div className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-8">
                <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#df8448]">
                    <ArrowLeft size={14} /> Back to orders
                </Link>

                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#df8448]">Order detail</p>
                        <h1 className="mt-2 text-[30px] font-bold tracking-tight text-[#3e4c57]">#{order.reference}</h1>
                        <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-500">
                            <Calendar size={14} />
                            {new Date(order.created_at).toLocaleString()}
                            {orderId ? <span className="text-zinc-300">•</span> : null}
                            {orderId ? <span>Internal ID {orderId}</span> : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <StatusPill label={order.status_label} tone="blue" />
                        <StatusPill label={order.payment_status_label} tone={order.payment_status === "paid" ? "green" : order.payment_status === "awaiting-payment" ? "amber" : "zinc"} />
                        <StatusPill label={order.fulfillment_status_label} tone={order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered" ? "green" : order.fulfillment_status === "processing" ? "blue" : "zinc"} />
                    </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                    <div className="space-y-6">
                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Items</h2>
                            </div>
                            <div className="divide-y divide-zinc-100">
                                {productLines.map((line) => (
                                    <div key={line.id} className="flex items-center gap-4 px-6 py-5">
                                        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-[#f8f9fa]">
                                            {line.image ? (
                                                <Image src={line.image} alt={line.description} fill sizes="64px" className="object-contain p-1.5" />
                                            ) : (
                                                <Package size={20} className="text-zinc-300" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[14px] font-semibold text-[#3e4c57]">{line.description}</p>
                                            <p className="mt-1 text-[12px] uppercase tracking-wider text-zinc-400">Qty {line.quantity}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[13px] text-zinc-500">${line.unit_price} each</p>
                                            <p className="mt-1 text-[14px] font-bold text-[#df8448]">${line.sub_total}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Customer & fulfillment</h2>
                            </div>
                            <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <Mail size={12} /> Customer
                                    </p>
                                    <p className="text-[14px] text-[#3e4c57]">{order.customer_email}</p>
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <Truck size={12} /> Shipping method
                                    </p>
                                    <p className="text-[14px] text-[#3e4c57]">{order.shipping_label}</p>
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <CreditCard size={12} /> Payment method
                                    </p>
                                    <p className="text-[14px] text-[#3e4c57]">{order.payment_label || formatMethodLabel(order.payment_method, "Card")}</p>
                                    <p className="mt-1 text-[12px] leading-5 text-zinc-500">{paymentStateMessage(order)}</p>
                                    {order.payment_intent_status ? (
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                                            Intent status: {order.payment_intent_status.replace(/_/g, " ")}
                                        </p>
                                    ) : null}
                                    {order.payment_last_event_type ? (
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                                            Last event: {order.payment_last_event_type}
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <Package size={12} /> Tracking number
                                    </p>
                                    <p className="text-[14px] text-[#3e4c57]">{order.tracking_number}</p>
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <Package size={12} /> Customer note
                                    </p>
                                    <p className="text-[14px] leading-6 text-zinc-500 whitespace-pre-line">{order.customer_note || "No customer note."}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Order timeline</h2>
                            </div>
                            <div className="px-6 py-6">
                                <div className="space-y-5">
                                    {timeline.map((item, index) => (
                                        <div key={item.key} className="relative flex gap-4">
                                            {index < timeline.length - 1 ? (
                                                <span className={`absolute left-[11px] top-6 h-[calc(100%+8px)] w-px ${item.done ? "bg-[#df8448]" : "bg-zinc-200"}`} />
                                            ) : null}
                                            <span className={`relative z-10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${item.done ? "border-[#df8448] bg-[#df8448] text-white" : "border-zinc-300 bg-white text-zinc-400"}`}>
                                                {item.done ? "✓" : "•"}
                                            </span>
                                            <div>
                                                <p className="text-[14px] font-semibold text-[#3e4c57]">{item.label}</p>
                                                <p className="mt-1 text-[12.5px] leading-6 text-zinc-500">{item.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Order history</h2>
                            </div>
                            <div className="px-6 py-6">
                                <div className="space-y-4">
                                    {orderEvents.map((event, index) => (
                                        <div key={`${event.type}-${event.created_at}-${index}`} className="rounded-xl border border-zinc-100 bg-[#fafbfc] px-4 py-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[13px] font-semibold text-[#3e4c57]">{event.title}</p>
                                                    {event.detail ? (
                                                        <p className="mt-1 text-[12.5px] leading-6 text-zinc-500">{event.detail}</p>
                                                    ) : null}
                                                </div>
                                                <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                                                    {new Date(event.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Operations</h2>
                            </div>
                            <form onSubmit={handleSaveOperations} className="grid gap-5 px-6 py-6">
                                {order.available_actions && order.available_actions.length > 0 ? (
                                    <div className="flex flex-wrap gap-3">
                                        {order.available_actions.map((item) => (
                                            <button
                                                key={item.action}
                                                type="button"
                                                disabled={activeAction === item.action || isSaving}
                                                onClick={() => handleRunAction(item.action)}
                                                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#df8448] px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#df8448] transition hover:bg-[#fff4ec] disabled:opacity-60"
                                            >
                                                {activeAction === item.action ? "Working..." : item.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="grid gap-5 md:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Order status</span>
                                        <select
                                            value={operationsForm.status}
                                            onChange={(event) => setOperationsForm((current) => ({ ...current, status: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                        >
                                            <option value="awaiting-payment">Awaiting payment</option>
                                            <option value="payment-offline">Payment offline</option>
                                            <option value="payment-received">Payment received</option>
                                            <option value="processing">Processing</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Tracking number</span>
                                        <input
                                            value={operationsForm.tracking_number}
                                            onChange={(event) => setOperationsForm((current) => ({ ...current, tracking_number: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                            placeholder="Tracking number"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Carrier</span>
                                        <select
                                            value={operationsForm.shipment_carrier}
                                            onChange={(event) => setOperationsForm((current) => ({ ...current, shipment_carrier: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                        >
                                            {shipmentCarrierOptions.map((carrier) => (
                                                <option key={carrier.value} value={carrier.value}>
                                                    {carrier.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="block">
                                    <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Tracking URL</span>
                                    <input
                                        value={operationsForm.shipment_tracking_url}
                                        onChange={(event) => setOperationsForm((current) => ({ ...current, shipment_tracking_url: event.target.value }))}
                                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                        placeholder="https://carrier.example/track/..."
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Internal note</span>
                                    <textarea
                                        value={operationsForm.internal_note}
                                        onChange={(event) => setOperationsForm((current) => ({ ...current, internal_note: event.target.value }))}
                                        className="min-h-[120px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] leading-6 text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                        placeholder="Internal note for support/ops team"
                                    />
                                </label>

                                {saveError ? (
                                    <p className="text-[13px] font-medium text-red-600">{saveError}</p>
                                ) : null}
                                {saveMessage ? (
                                    <p className="text-[13px] font-medium text-green-600">{saveMessage}</p>
                                ) : null}

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#df8448] px-6 text-[12px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#c9713a] disabled:opacity-60"
                                    >
                                        {isSaving ? "Saving..." : "Save operations"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Shipments</h2>
                            </div>
                            <div className="space-y-5 px-6 py-6">
                                <form onSubmit={handleCreateShipment} className="rounded-xl border border-zinc-100 bg-[#fafbfc] p-4">
                                    <div className="mb-4">
                                        <h3 className="text-[13px] font-semibold text-[#3e4c57]">Create shipment</h3>
                                        <p className="mt-1 text-[12px] text-zinc-500">Use this when an order ships in multiple packages.</p>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <input
                                            value={newShipmentForm.tracking_number}
                                            onChange={(event) => setNewShipmentForm((current) => ({ ...current, tracking_number: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                            placeholder="Tracking number"
                                            required
                                        />
                                        <select
                                            value={newShipmentForm.shipment_carrier}
                                            onChange={(event) => setNewShipmentForm((current) => ({ ...current, shipment_carrier: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                        >
                                            {shipmentCarrierOptions.map((carrier) => (
                                                <option key={carrier.value} value={carrier.value}>
                                                    {carrier.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            value={newShipmentForm.shipment_tracking_url}
                                            onChange={(event) => setNewShipmentForm((current) => ({ ...current, shipment_tracking_url: event.target.value }))}
                                            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-[#3e4c57] outline-none transition focus:border-[#df8448]"
                                            placeholder="Optional tracking URL"
                                        />
                                    </div>
                                    {shipmentError ? <p className="mt-3 text-[13px] font-medium text-red-600">{shipmentError}</p> : null}
                                    {shipmentMessage ? <p className="mt-3 text-[13px] font-medium text-green-600">{shipmentMessage}</p> : null}
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={isCreatingShipment}
                                            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#3e4c57] px-4 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#2f3d46] disabled:opacity-60"
                                        >
                                            {isCreatingShipment ? "Creating..." : "Add shipment"}
                                        </button>
                                    </div>
                                </form>
                                {(order.shipments && order.shipments.length > 0 ? order.shipments : [{
                                    id: "legacy",
                                    tracking_number: order.tracking_number,
                                    carrier: "manual",
                                    status: order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered" ? "in_transit" : "label_created",
                                    shipped_at: order.shipped_at,
                                    delivered_at: order.delivered_at,
                                }]).map((shipment) => (
                                    <div key={shipment.id} className="rounded-xl border border-zinc-100 bg-[#fafbfc] px-4 py-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[13px] font-semibold text-[#3e4c57]">
                                                    {shipment.tracking_number}
                                                </p>
                                                <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-zinc-400">
                                                    {(shipment.carrier || "manual").replace(/_/g, " ")} • {shipment.status.replace(/_/g, " ")}
                                                </p>
                                                {shipment.tracking_url ? (
                                                    <a
                                                        href={shipment.tracking_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-2 inline-flex text-[12px] font-semibold text-[#df8448] hover:underline"
                                                    >
                                                        Open tracking link
                                                    </a>
                                                ) : null}
                                            </div>
                                            <div className="text-right text-[12px] leading-5 text-zinc-500">
                                                {shipment.shipped_at ? <p>Shipped: {new Date(shipment.shipped_at).toLocaleString()}</p> : null}
                                                {shipment.delivered_at ? <p>Delivered: {new Date(shipment.delivered_at).toLocaleString()}</p> : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Order summary</h2>
                            </div>
                            <div className="space-y-3 px-6 py-6 text-[14px]">
                                <div className="flex items-center justify-between text-zinc-500">
                                    <span>Subtotal</span>
                                    <span className="font-medium text-[#3e4c57]">${order.sub_total}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-500">
                                    <span>Shipping</span>
                                    <span className="font-medium text-[#3e4c57]">{parseFloat(order.shipping_total) === 0 ? "Free" : `$${order.shipping_total}`}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-500">
                                    <span>Discount</span>
                                    <span className="font-medium text-[#df8448]">{parseFloat(order.discount_total) > 0 ? `-$${order.discount_total}` : "$0.00"}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-500">
                                    <span>Tax</span>
                                    <span className="font-medium text-[#3e4c57]">${order.tax_total}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                                    <span className="font-bold text-[#3e4c57]">Total</span>
                                    <span className="text-[18px] font-black text-[#df8448]">${order.total.decimal.toFixed(2)}</span>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                            <div className="border-b border-zinc-100 px-6 py-5">
                                <h2 className="text-[16px] font-bold text-[#3e4c57]">Addresses</h2>
                            </div>
                            <div className="grid gap-6 px-6 py-6">
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <MapPin size={12} /> Shipping address
                                    </p>
                                    <p className="text-[14px] leading-6 text-[#3e4c57]">{formatAddress(order.shipping_address)}</p>
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        <MapPin size={12} /> Billing address
                                    </p>
                                    <p className="text-[14px] leading-6 text-[#3e4c57]">{formatAddress(order.billing_address)}</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}
