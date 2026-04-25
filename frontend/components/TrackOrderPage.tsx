"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Package, CheckCircle2, Truck, HelpCircle, ChevronRight, Mail, ArrowLeft } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import { getApiBaseUrl } from "@/lib/api";
import RetryPaymentPanel from "./orders/RetryPaymentPanel";

type OrderAddress = {
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

type TrackedOrder = {
    reference: string;
    created_at: string;
    status: string;
    status_label: string;
    payment_status: string;
    payment_status_label: string;
    payment_label?: string | null;
    payment_intent_status?: string | null;
    payment_method: string | null;
    shipping_method: string | null;
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
    total: {
        decimal: number;
    };
    shipping_address: OrderAddress;
};

function paymentStateHint(order: TrackedOrder) {
    if (order.payment_status === "paid") {
        return "Payment confirmed";
    }

    if (order.payment_status === "processing" || order.payment_intent_status === "processing") {
        return "Payment processing";
    }

    if (order.payment_status === "failed") {
        return "Payment failed";
    }

    return order.payment_status_label;
}

function formatMethodLabel(value: string | null, fallback: string) {
    return (value || fallback)
        .replace(/[_-]/g, " ")
        .replace(/\bcod\b/i, "Cash on delivery")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function latestShipment(order: TrackedOrder) {
    return order.shipments?.[order.shipments.length - 1] ?? null;
}

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
    animate: { transition: { staggerChildren: 0.1 } }
};

export default function TrackOrderPage() {
    const [orderId, setOrderId] = useState("");
    const [email, setEmail] = useState("");
    const [statusData, setStatusData] = useState<TrackedOrder | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const formatAddress = (address: OrderAddress) => {
        return [
            [address.first_name, address.last_name].filter(Boolean).join(" ").trim(),
            address.line_one,
            address.line_two,
            [address.city, address.state, address.postcode].filter(Boolean).join(", ").trim(),
            address.country,
        ].filter(Boolean).join(", ");
    };

    const fetchTrackedOrder = async (trackingNumber: string, trackingEmail: string) => {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/orders/track`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                tracking_number: trackingNumber.trim(),
                email: trackingEmail.trim(),
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Order not found or invalid details. Please verify your Tracking Number and Email.");
        }

        const data = await res.json();
        return data?.data ?? null;
    };

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setStatusData(null);

        try {
            const data = await fetchTrackedOrder(orderId, email);
            setStatusData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not connect to the tracking server. Please check your connection and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-hanken">
            <Header />

            <main>
                {/* Hero Section */}
                <section className="bg-[#f8f9fa] py-20 px-4">
                    <div className="max-w-4xl mx-auto text-center">
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="inline-block px-4 py-1.5 bg-[#df8448]/10 text-[#df8448] text-[11px] font-bold uppercase tracking-[0.2em] rounded-[3px] mb-6"
                        >
                            Order Tracking
                        </motion.span>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[32px] md:text-[48px] font-bold text-[#3e4c57] mb-6 leading-tight tracking-[0.1em] uppercase"
                        >
                            TRACK YOUR ORDER
                        </motion.h1>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-[18px] md:text-[22px] text-zinc-500 max-w-2xl mx-auto leading-relaxed italic font-medium"
                        >
                            Want to check the status of your order? Enter your details below to see its journey in real-time.
                        </motion.p>
                    </div>
                </section>

                {/* Tracking Form Section */}
                <section className="py-24 px-4 relative overflow-hidden">
                    <div className="max-w-[1200px] mx-auto">
                        <div className="grid lg:grid-cols-2 gap-16 items-start">
                            {/* Left Side: Form */}
                            <motion.div
                                initial="initial"
                                whileInView="animate"
                                viewport={{ once: true }}
                                variants={fadeUp}
                                className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 relative z-10"
                            >
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-[#df8448] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                                        <Search size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-[24px] font-bold text-[#3e4c57]">Check Your Order Status</h2>
                                        <div className="h-1 w-12 bg-[#df8448] mt-2 rounded-full" />
                                    </div>
                                </div>

                                <p className="text-zinc-500 text-[15px] mb-10 leading-relaxed uppercase tracking-wider font-medium">
                                    To track your order please enter your Tracking Number in the box below and press the &quot;Track&quot; button. This was given to you on your receipt and in the confirmation email you should have received.
                                </p>

                                <form onSubmit={handleTrack} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Tracking Number</label>
                                            <input
                                                type="text"
                                                required
                                                value={orderId}
                                                onChange={(e) => setOrderId(e.target.value)}
                                                placeholder="e.g. PP-XXXXXX-XXXX"
                                                className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium"
                                            />
                                            <p className="text-[11px] text-zinc-400 italic ml-1">(Found in your order confirmation email.)</p>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Billing Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="email@example.com"
                                                className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium"
                                            />
                                            <p className="text-[11px] text-zinc-400 italic ml-1">(Email you used during checkout.)</p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                    >
                                        {isLoading ? 'Tracking...' : 'Track My Order'}
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </form>

                                {error && (
                                    <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[13px] font-medium">
                                        {error}
                                    </div>
                                )}

                                {statusData && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-10 space-y-4"
                                    >
                                        <div className="rounded-2xl border border-[#df8448]/20 bg-[#f8f9fa] p-6 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4 border-b border-zinc-200 pb-4">
                                                <CheckCircle2 className="text-green-500" size={24} />
                                                <div>
                                                    <h3 className="text-[16px] font-bold text-[#3e4c57]">Order Found: {statusData.reference}</h3>
                                                    <p className="text-[12px] text-zinc-500 font-medium">Placed on {new Date(statusData.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4 pt-2">
                                                <div className="flex justify-between items-center text-[13px]">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Status</span>
                                                    <span className="bg-[#df8448] text-white px-3 py-1 rounded-[4px] font-black uppercase text-[10px] tracking-widest">{statusData.status_label}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[13px]">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Total</span>
                                                    <span className="font-black text-[#3e4c57]">${statusData.total.decimal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[13px]">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Shipping</span>
                                                    <span className="font-medium text-[#3e4c57]">{formatMethodLabel(statusData.shipping_method, "Standard")}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[13px]">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Payment</span>
                                                    <div className="text-right">
                                                        <p className="font-medium text-[#3e4c57]">{formatMethodLabel(statusData.payment_label || statusData.payment_method, "Card")}</p>
                                                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-zinc-400">{paymentStateHint(statusData)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-start text-[13px]">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Destination</span>
                                                    <span className="font-medium text-[#3e4c57] text-right max-w-[220px]">{formatAddress(statusData.shipping_address)}</span>
                                                </div>
                                                {latestShipment(statusData)?.tracking_url ? (
                                                    <div className="flex justify-between items-center text-[13px]">
                                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Tracking link</span>
                                                        <a
                                                            href={latestShipment(statusData)?.tracking_url || "#"}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="font-semibold text-[#df8448] hover:underline"
                                                        >
                                                            Open carrier tracking
                                                        </a>
                                                    </div>
                                                ) : null}
                                            </div>
                                            {statusData.order_events && statusData.order_events.length > 0 ? (
                                                <div className="mt-5 border-t border-zinc-200 pt-4">
                                                    <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                                        Recent updates
                                                    </p>
                                                    <div className="space-y-3">
                                                        {[...statusData.order_events].reverse().slice(0, 4).map((event, index) => (
                                                            <div key={`${event.type}-${event.created_at}-${index}`} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div>
                                                                        <p className="text-[12.5px] font-semibold text-[#3e4c57]">{event.title}</p>
                                                                        {event.detail ? (
                                                                            <p className="mt-1 text-[12px] leading-5 text-zinc-500">{event.detail}</p>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                                                                        {new Date(event.created_at).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                        <RetryPaymentPanel
                                            reference={statusData.reference}
                                            email={email}
                                            customerName={`${statusData.shipping_address.first_name || ""} ${statusData.shipping_address.last_name || ""}`.trim()}
                                            paymentMethod={statusData.payment_method}
                                            paymentStatus={statusData.payment_status}
                                            orderStatus={statusData.status}
                                            onCompleted={() => {
                                                void fetchTrackedOrder(orderId, email).then(setStatusData).catch((err) => {
                                                    setError(err instanceof Error ? err.message : "Failed to refresh order.");
                                                });
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </motion.div>

                            {/* Right Side: Info & Steps */}
                            <motion.div
                                initial="initial"
                                whileInView="animate"
                                viewport={{ once: true }}
                                variants={staggerContainer}
                                className="lg:pt-12"
                            >
                                <motion.div variants={fadeUp} className="mb-12">
                                    <h3 className="text-[28px] font-bold text-[#3e4c57] mb-4 flex items-center gap-4">
                                        Tracking Questions?
                                        <HelpCircle className="text-[#df8448]" size={24} />
                                    </h3>
                                    <div className="h-1 w-12 bg-[#df8448] mt-2 rounded-full" />
                                </motion.div>

                                <div className="space-y-10">
                                    {[
                                        {
                                            icon: Package,
                                            title: "When will I get my tracking number?",
                                            text: "Tracking numbers are typically assigned within 24-48 hours once your order has been processed and is ready for shipment."
                                        },
                                        {
                                            icon: Truck,
                                            title: "My order hasn't updated lately.",
                                            text: "Sometimes tracking can pause while in transit between hubs. If there is no update for more than 5 business days, please contact us."
                                        },
                                        {
                                            icon: Mail,
                                            title: "Still need help?",
                                            text: "Reach out to our support team at support@petposture.com or call us directly at +1 (916) 668-0065."
                                        }
                                    ].map((item, idx) => (
                                        <motion.div key={idx} variants={fadeUp} className="flex gap-6 group">
                                            <div className="w-14 h-14 rounded-2xl bg-[#f8f9fa] flex items-center justify-center text-[#3e4c57] group-hover:bg-[#df8448] group-hover:text-white transition-all duration-300 flex-shrink-0 shadow-sm">
                                                <item.icon size={26} strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <h4 className="text-[17px] font-bold text-[#3e4c57] mb-2 group-hover:text-[#df8448] transition-colors">{item.title}</h4>
                                                <p className="text-zinc-500 text-[15px] leading-relaxed">{item.text}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <motion.div variants={fadeUp} className="mt-16 p-8 bg-[#fdf2ea] rounded-3xl text-[#3e4c57] relative overflow-hidden border border-orange-100/50">
                                    <div className="relative z-10">
                                        <h4 className="text-[18px] font-bold mb-4">Quality Guarantee</h4>
                                        <p className="text-zinc-600 text-[14px] leading-relaxed mb-6">
                                            Every PetPosture product undergoes rigorous quality checks before leaving our facility to ensure your pet receives only the best.
                                        </p>
                                        <Link href="/contact" className="text-[#df8448] font-bold uppercase tracking-widest text-[11px] flex items-center gap-2 hover:text-[#3e4c57] transition-colors">
                                            Contact Support <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#df8448]/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Background Decorative Elements */}
                    <div className="absolute top-40 right-[-10%] w-[500px] h-[500px] bg-[#df8448]/5 rounded-full blur-[120px] pointer-events-none" />
                    <div className="absolute bottom-20 left-[-10%] w-[400px] h-[400px] bg-[#3e4c57]/5 rounded-full blur-[100px] pointer-events-none" />
                </section>

                {/* Return Link Footer */}
                <section className="py-16 bg-zinc-50">
                    <div className="max-w-[1200px] mx-auto px-4 text-center">
                        <Link href="/" className="inline-flex items-center gap-3 text-[#3e4c57]/40 hover:text-[#df8448] font-bold uppercase tracking-[0.25em] text-[12px] transition-all">
                            <ArrowLeft size={16} /> Back to Homepage
                        </Link>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
