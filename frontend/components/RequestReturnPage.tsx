"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, ChevronRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import { getApiBaseUrl } from "@/lib/api";

type OrderLine = {
    id: number;
    type: string;
    description: string;
    quantity: number;
    image: string | null;
};

type LookedUpOrder = {
    reference: string;
    status: string;
    lines: OrderLine[];
};

const REASONS = [
    "Doesn't fit",
    "Arrived damaged or defective",
    "Not as described",
    "Changed my mind",
    "Other",
];

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

function RequestReturnContent() {
    const searchParams = useSearchParams();
    const prefillRef = searchParams.get("ref") ?? "";
    const prefillEmail = searchParams.get("email") ?? "";

    const [orderReference, setOrderReference] = useState(prefillRef);
    const [email, setEmail] = useState(prefillEmail);
    const [order, setOrder] = useState<LookedUpOrder | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);

    const [selectedQuantities, setSelectedQuantities] = useState<Record<number, number>>({});
    const [reason, setReason] = useState(REASONS[0]);
    const [note, setNote] = useState("");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const lookupOrder = async (reference: string, orderEmail: string) => {
        setIsLookingUp(true);
        setLookupError(null);
        setOrder(null);

        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/orders/track`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tracking_number: reference.trim(),
                    email: orderEmail.trim(),
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Order not found. Please verify your order number and email.");
            }

            const data = await res.json();
            const foundOrder: LookedUpOrder = data?.data ?? null;

            if (!foundOrder || !["delivered", "shipped"].includes(foundOrder.status)) {
                throw new Error("This order isn't eligible for a return yet. Returns can be requested once an order has shipped or been delivered.");
            }

            setOrder(foundOrder);
        } catch (err) {
            setLookupError(err instanceof Error ? err.message : "Could not connect to the server. Please try again.");
        } finally {
            setIsLookingUp(false);
        }
    };

    useEffect(() => {
        if (prefillRef && prefillEmail) {
            void lookupOrder(prefillRef, prefillEmail);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        await lookupOrder(orderReference, email);
    };

    const productLines = order?.lines.filter((line) => line.type !== "shipping") ?? [];

    const toggleItem = (lineId: number, maxQuantity: number) => {
        setSelectedQuantities((prev) => {
            const next = { ...prev };
            if (next[lineId]) {
                delete next[lineId];
            } else {
                next[lineId] = maxQuantity;
            }
            return next;
        });
    };

    const updateQuantity = (lineId: number, quantity: number) => {
        setSelectedQuantities((prev) => ({ ...prev, [lineId]: quantity }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        const items = Object.entries(selectedQuantities).map(([lineId, quantity]) => ({
            order_line_id: Number(lineId),
            quantity,
        }));

        if (items.length === 0) {
            setSubmitError("Select at least one item to return.");
            return;
        }

        setIsSubmitting(true);

        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/orders/return-requests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_reference: orderReference.trim(),
                    email: email.trim(),
                    reason,
                    note: note.trim() || undefined,
                    items,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Could not submit your return request. Please try again.");
            }

            setSubmitted(true);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Could not connect to the server. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-hanken">
            <Header />

            <main>
                <section className="bg-[#f8f9fa] py-20 px-4">
                    <div className="max-w-4xl mx-auto text-center">
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="inline-block px-4 py-1.5 bg-[#df8448]/10 text-[#df8448] text-[11px] font-bold uppercase tracking-[0.2em] rounded-[3px] mb-6"
                        >
                            Returns
                        </motion.span>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[32px] md:text-[48px] font-bold text-[#3e4c57] mb-6 leading-tight tracking-[0.1em] uppercase"
                        >
                            Request a Return
                        </motion.h1>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-[18px] md:text-[22px] text-zinc-500 max-w-2xl mx-auto leading-relaxed italic font-medium"
                        >
                            Enter your order number and email to start a return.
                        </motion.p>
                    </div>
                </section>

                <section className="py-24 px-4">
                    <div className="max-w-3xl mx-auto">
                        <motion.div
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            variants={fadeUp}
                            className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100"
                        >
                            {submitted ? (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="mx-auto text-green-500 mb-6" size={48} />
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] mb-3">Return request submitted</h2>
                                    <p className="text-zinc-500 text-[15px] leading-relaxed mb-8">
                                        We&rsquo;ve received your request for order #{order?.reference}. Our team will review it and email you with next steps.
                                    </p>
                                    <Link href="/" className="inline-flex items-center gap-3 text-[#df8448] font-bold uppercase tracking-[0.2em] text-[12px] hover:text-[#3e4c57] transition-all">
                                        <ArrowLeft size={16} /> Back to Homepage
                                    </Link>
                                </div>
                            ) : !order ? (
                                <>
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-[#df8448] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                                            <Search size={24} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h2 className="text-[24px] font-bold text-[#3e4c57]">Find Your Order</h2>
                                            <div className="h-1 w-12 bg-[#df8448] mt-2 rounded-full" />
                                        </div>
                                    </div>

                                    <form onSubmit={handleLookup} className="space-y-8">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Order Number</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={orderReference}
                                                    onChange={(e) => setOrderReference(e.target.value)}
                                                    placeholder="e.g. 00000014"
                                                    className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Email</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="email@example.com"
                                                    className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLookingUp}
                                            className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                        >
                                            {isLookingUp ? "Looking up..." : "Find My Order"}
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </form>

                                    {lookupError && (
                                        <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[13px] font-medium">
                                            {lookupError}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div>
                                        <h2 className="text-[24px] font-bold text-[#3e4c57]">Order #{order.reference}</h2>
                                        <p className="text-zinc-500 text-[14px] mt-2">Select the item(s) you&rsquo;d like to return.</p>
                                    </div>

                                    <div className="space-y-4">
                                        {productLines.map((line) => {
                                            const isSelected = line.id in selectedQuantities;
                                            return (
                                                <div key={line.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isSelected ? "border-[#df8448] bg-[#fdf2ea]" : "border-zinc-100"}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleItem(line.id, line.quantity)}
                                                        className="w-5 h-5 accent-[#df8448]"
                                                    />
                                                    {line.image && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={line.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="text-[14px] font-semibold text-[#3e4c57]">{line.description}</p>
                                                        <p className="text-[12px] text-zinc-400">Ordered: {line.quantity}</p>
                                                    </div>
                                                    {isSelected && line.quantity > 1 && (
                                                        <select
                                                            value={selectedQuantities[line.id]}
                                                            onChange={(e) => updateQuantity(line.id, Number(e.target.value))}
                                                            className="px-3 py-2 rounded-lg border border-zinc-200 text-[13px] font-medium text-[#3e4c57]"
                                                        >
                                                            {Array.from({ length: line.quantity }, (_, i) => i + 1).map((q) => (
                                                                <option key={q} value={q}>Qty: {q}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Reason for return</label>
                                        <select
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium"
                                        >
                                            {REASONS.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[12px] font-extrabold uppercase tracking-widest text-[#3e4c57] ml-1">Additional notes (optional)</label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            rows={4}
                                            placeholder="Anything else we should know?"
                                            className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium resize-none"
                                        />
                                    </div>

                                    {submitError && (
                                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[13px] font-medium">
                                            {submitError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit Return Request"}
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default function RequestReturnPage() {
    return (
        <Suspense fallback={null}>
            <RequestReturnContent />
        </Suspense>
    );
}
