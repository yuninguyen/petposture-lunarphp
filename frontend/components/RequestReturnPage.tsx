"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, ChevronRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import { fetchApi } from "@/lib/fetchApi";

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
    delivered_at: string | null;
};

const RETURN_WINDOW_DAYS = 30;

function getReturnWindowMessage(order: LookedUpOrder): { text: string; expired: boolean } | null {
    if (order.status !== "delivered" || !order.delivered_at) {
        return null;
    }

    const deadline = new Date(order.delivered_at).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));

    if (daysLeft <= 0) {
        return { text: "This order is outside our 30-day return window.", expired: true };
    }

    return { text: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the 30-day return window.`, expired: false };
}

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
    const prefillToken = searchParams.get("token") ?? "";
    const prefillEmail = searchParams.get("email") ?? "";

    const [trackingToken, setTrackingToken] = useState(prefillToken);
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

    const [estimate, setEstimate] = useState<{ restocking_fee: number; estimated_refund: number } | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);

    const lookupOrder = async (accessToken: string, orderEmail: string) => {
        setIsLookingUp(true);
        setLookupError(null);
        setOrder(null);

        try {
            const res = await fetchApi('/api/orders/return-requests/options', {
                method: "POST",
                body: {
                    tracking_token: accessToken.trim(),
                    email: orderEmail.trim(),
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Unable to access this order. Please verify your tracking token and email.");
            }

            const data = await res.json();
            const foundOrder: LookedUpOrder = data?.data ?? null;

            if (!foundOrder || !["delivered", "shipped"].includes(foundOrder.status)) {
                throw new Error("This order isn't eligible for a return yet. Returns can be requested once an order has shipped or been delivered.");
            }

            if (data?.has_active_return_request) {
                throw new Error("You already have a return request in progress for this order. Check your email for updates from our team.");
            }

            setOrder(foundOrder);
        } catch (err) {
            setLookupError(err instanceof Error ? err.message : "Could not connect to the server. Please try again.");
        } finally {
            setIsLookingUp(false);
        }
    };

    useEffect(() => {
        if (prefillToken && prefillEmail) {
            void lookupOrder(prefillToken, prefillEmail);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        await lookupOrder(trackingToken, email);
    };

    const productLines = order?.lines.filter((line) => line.type !== "shipping") ?? [];

    const selectedQuantitiesKey = JSON.stringify(selectedQuantities);

    useEffect(() => {
        if (!order || Object.keys(selectedQuantities).length === 0) {
            setEstimate(null);
            return;
        }

        const timeout = setTimeout(async () => {
            setIsEstimating(true);
            try {
                const items = Object.entries(selectedQuantities).map(([lineId, quantity]) => ({
                    order_line_id: Number(lineId),
                    quantity,
                }));

                const res = await fetchApi('/api/orders/return-requests/preview', {
                    method: "POST",
                    body: {
                        tracking_token: trackingToken.trim(),
                        email: email.trim(),
                        items,
                    },
                });

                setEstimate(res.ok ? await res.json() : null);
            } catch {
                setEstimate(null);
            } finally {
                setIsEstimating(false);
            }
        }, 400);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedQuantitiesKey, order]);

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
            const res = await fetchApi('/api/orders/return-requests', {
                method: "POST",
                body: {
                    tracking_token: trackingToken.trim(),
                    email: email.trim(),
                    reason,
                    note: note.trim() || undefined,
                    items,
                },
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
                            className="inline-block px-4 py-1.5 bg-secondary/10 text-rust text-xs font-bold uppercase tracking-[0.2em] rounded-[3px] mb-6"
                        >
                            Returns
                        </motion.span>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[32px] md:text-[48px] font-bold text-primary mb-6 leading-tight tracking-[0.1em] uppercase"
                        >
                            Request a Return
                        </motion.h1>
                        <div className="w-12 h-1 bg-secondary mx-auto rounded-full mb-6"></div>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-[18px] md:text-[22px] text-zinc-500 max-w-2xl mx-auto leading-relaxed italic font-medium"
                        >
                            Enter your private tracking access token and email to start a return.
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
                                    <h2 className="text-[24px] font-bold text-primary mb-3">Return request submitted</h2>
                                    <p className="text-zinc-500 text-[15px] leading-relaxed mb-8">
                                        We&rsquo;ve received your request for order #{order?.reference}. Our team will review it and email you with next steps.
                                    </p>
                                    <Link href="/" className="inline-flex items-center gap-3 text-[#1a2128b8] hover:text-rust font-bold uppercase tracking-[0.1em] text-sm transition-all">
                                        <ArrowLeft size={16} /> Back to Homepage
                                    </Link>
                                </div>
                            ) : !order ? (
                                <>
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-ink shadow-lg shadow-orange-200">
                                            <Search size={24} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h2 className="text-[24px] font-bold text-primary">Find Your Order</h2>
                                            <div className="h-1 w-12 bg-secondary mt-2 rounded-full" />
                                        </div>
                                    </div>

                                    <form onSubmit={handleLookup} className="space-y-8">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="block pb-1 text-sm font-semibold text-primary ml-1">Tracking access token</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={trackingToken}
                                                    onChange={(e) => setTrackingToken(e.target.value)}
                                                    placeholder="e.g. 00000014"
                                                    className="w-full px-6 py-3 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium placeholder:text-[13px]"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block pb-1 text-sm font-semibold text-primary ml-1">Email</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="email@example.com"
                                                    className="w-full px-6 py-3 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium placeholder:text-[13px]"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLookingUp}
                                            className="w-full bg-secondary text-ink py-5 rounded-xl font-bold text-[15px] hover:bg-secondary-dark disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                        >
                                            {isLookingUp ? "Looking up..." : "Find my order"}
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </form>

                                    {lookupError && (
                                        <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                                            {lookupError}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div>
                                        <h2 className="text-[24px] font-bold text-primary">Order #{order.reference}</h2>
                                        <p className="text-zinc-500 text-[14px] mt-2">Select the item(s) you&rsquo;d like to return.</p>
                                        {(() => {
                                            const windowMessage = getReturnWindowMessage(order);
                                            if (!windowMessage) return null;
                                            return (
                                                <p className={`text-sm font-semibold mt-2 ${windowMessage.expired ? "text-red-500" : "text-rust"}`}>
                                                    {windowMessage.text}
                                                </p>
                                            );
                                        })()}
                                    </div>

                                    <div className="space-y-4">
                                        {productLines.map((line) => {
                                            const isSelected = line.id in selectedQuantities;
                                            return (
                                                <div key={line.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isSelected ? "border-secondary bg-secondary-light" : "border-zinc-100"}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleItem(line.id, line.quantity)}
                                                        className="w-5 h-5 accent-secondary"
                                                    />
                                                    {line.image && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={line.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="text-[14px] font-semibold text-primary">{line.description}</p>
                                                        <p className="text-xs text-zinc-400">Ordered: {line.quantity}</p>
                                                    </div>
                                                    {isSelected && line.quantity > 1 && (
                                                        <select
                                                            value={selectedQuantities[line.id]}
                                                            onChange={(e) => updateQuantity(line.id, Number(e.target.value))}
                                                            className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-primary"
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

                                    <div className="space-y-2">
                                        <label className="block pb-1 text-sm font-semibold text-primary ml-1">Reason for return</label>
                                        <select
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full px-6 py-3 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium"
                                        >
                                            {REASONS.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block pb-1 text-sm font-semibold text-primary ml-1">Additional notes (optional)</label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            rows={4}
                                            placeholder="Anything else we should know?"
                                            className="w-full px-6 py-3 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium resize-none placeholder:text-[13px]"
                                        />
                                    </div>

                                    {isEstimating ? (
                                        <p className="text-sm text-zinc-400">Calculating estimated refund…</p>
                                    ) : estimate ? (
                                        <div className="p-4 bg-secondary-light border border-secondary/20 rounded-xl">
                                            <p className="text-[14px] font-bold text-primary">
                                                Estimated refund: ${estimate.estimated_refund.toFixed(2)}
                                            </p>
                                            <p className="text-sm text-zinc-400 mt-1">
                                                Includes a ${estimate.restocking_fee.toFixed(2)} restocking fee (25%). Final amount confirmed after inspection.
                                            </p>
                                        </div>
                                    ) : null}

                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        Approved returns are refunded minus a 25% restocking fee and original shipping cost. See our{" "}
                                        <Link href="/return-refund-policy" className="text-rust font-semibold underline underline-offset-2" target="_blank">
                                            Return &amp; Refund Policy
                                        </Link>{" "}
                                        for full details.
                                    </p>

                                    {submitError && (
                                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                                            {submitError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-secondary text-ink py-5 rounded-xl font-bold text-[15px] hover:bg-secondary-dark disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit return request"}
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
