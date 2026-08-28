"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Package, CheckCircle2, Truck, HelpCircle, ChevronRight, Mail, ArrowLeft } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import { fetchApi } from "@/lib/fetchApi";
import RetryPaymentPanel from "./orders/RetryPaymentPanel";
import { useSettings } from "@/context/SettingsContext";

type OrderAddress = {
    city: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
};

type TrackedOrder = {
    reference: string;
    status: string;
    fulfillment_status: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    eta: string | null;
    shipping_address: OrderAddress;
};

function formatStatus(value: string) {
    return value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
    animate: { transition: { staggerChildren: 0.1 } }
};

export default function TrackOrderPage() {
    const { contact } = useSettings();
    const [trackingToken, setTrackingToken] = useState("");
    const [email, setEmail] = useState("");
    const [statusData, setStatusData] = useState<TrackedOrder | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const formatAddress = (address: OrderAddress) => {
        return [
            [address.city, address.state, address.postcode].filter(Boolean).join(", ").trim(),
            address.country,
        ].filter(Boolean).join(", ");
    };

    const fetchTrackedOrder = async (accessToken: string, trackingEmail: string) => {
        const res = await fetchApi('/api/orders/track', {
            method: "POST",
            body: {
                tracking_token: accessToken.trim(),
                email: trackingEmail.trim(),
            },
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Unable to access this order. Please verify your tracking access token and email.");
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
            const data = await fetchTrackedOrder(trackingToken, email);
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
                            className="inline-block px-4 py-1.5 bg-secondary/10 text-rust text-xs font-bold uppercase tracking-[0.2em] rounded-[3px] mb-6"
                        >
                            Order Tracking
                        </motion.span>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[32px] md:text-[48px] font-bold text-primary mb-6 leading-tight tracking-[0.1em] uppercase"
                        >
                            TRACK YOUR ORDER
                        </motion.h1>
                        <div className="w-12 h-1 bg-secondary mx-auto rounded-full mb-6"></div>
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
                                    <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-ink shadow-lg shadow-orange-200">
                                        <Search size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-[24px] font-bold text-primary">Check Your Order Status</h2>
                                        <div className="h-1 w-12 bg-secondary mt-2 rounded-full" />
                                    </div>
                                </div>

                                <p className="text-zinc-500 text-[15px] mb-10 leading-relaxed uppercase tracking-wider font-medium">
                                    Enter the private tracking access token from your confirmation link and the email used at checkout.
                                </p>

                                <form onSubmit={handleTrack} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-sm font-extrabold uppercase tracking-widest text-primary ml-1">Tracking Access Token</label>
                                            <input
                                                type="text"
                                                required
                                                value={trackingToken}
                                                onChange={(e) => setTrackingToken(e.target.value)}
                                                placeholder="64-character private token"
                                                className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium"
                                            />
                                            <p className="text-sm text-zinc-400 italic ml-1">(Found in your private order confirmation link.)</p>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-extrabold uppercase tracking-widest text-primary ml-1">Billing Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="email@example.com"
                                                className="w-full px-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-secondary focus:bg-white outline-none transition-all text-primary font-medium"
                                            />
                                            <p className="text-sm text-zinc-400 italic ml-1">(Email you used during checkout.)</p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-secondary text-ink py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-sm hover:bg-secondary-dark disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                                    >
                                        {isLoading ? 'Tracking...' : 'Track My Order'}
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </form>

                                {error && (
                                    <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                                        {error}
                                    </div>
                                )}

                                {statusData && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-10 space-y-4"
                                    >
                                        <div className="rounded-2xl border border-secondary/20 bg-[#f8f9fa] p-6 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4 border-b border-zinc-200 pb-4">
                                                <CheckCircle2 className="text-green-500" size={24} />
                                                <div>
                                                    <h3 className="text-[16px] font-bold text-primary">Order Found: {statusData.reference}</h3>
                                                    <p className="text-xs text-zinc-500 font-medium">Private tracking details</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4 pt-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Status</span>
                                                    <span className="bg-secondary text-ink px-3 py-1 rounded-[4px] font-black uppercase text-xs tracking-widest">{formatStatus(statusData.status)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Fulfillment</span>
                                                    <span className="font-medium text-primary">{formatStatus(statusData.fulfillment_status)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Carrier</span>
                                                    <span className="font-medium text-primary">{statusData.carrier ? formatStatus(statusData.carrier) : "Not assigned"}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Estimated arrival</span>
                                                    <span className="font-medium text-primary">{statusData.eta || "Pending carrier update"}</span>
                                                </div>
                                                <div className="flex justify-between items-start text-sm">
                                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Destination</span>
                                                    <span className="font-medium text-primary text-right max-w-[220px]">{formatAddress(statusData.shipping_address)}</span>
                                                </div>
                                                {statusData.tracking_url ? (
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Tracking link</span>
                                                        <a
                                                            href={statusData.tracking_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="font-semibold text-rust hover:underline"
                                                        >
                                                            Open carrier tracking
                                                        </a>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <RetryPaymentPanel
                                            trackingToken={trackingToken}
                                            email={email}
                                            orderStatus={statusData.status}
                                            onCompleted={() => {
                                                void fetchTrackedOrder(trackingToken, email).then(setStatusData).catch((err) => {
                                                    setError(err instanceof Error ? err.message : "Failed to refresh order.");
                                                });
                                            }}
                                        />
                                        {(statusData.status === "delivered" || statusData.status === "shipped") && (
                                            <div className="rounded-2xl border border-secondary/20 bg-white p-6 shadow-sm flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-bold text-primary">Need to send something back?</p>
                                                    <p className="mt-1 text-sm text-zinc-500">Request a return for this order.</p>
                                                </div>
                                                <Link
                                                    href={`/returns?token=${encodeURIComponent(trackingToken)}&email=${encodeURIComponent(email)}`}
                                                    className="whitespace-nowrap text-sm font-bold text-rust hover:text-rust transition-colors"
                                                >
                                                    Request a Return
                                                </Link>
                                            </div>
                                        )}
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
                                    <h3 className="text-[28px] font-bold text-primary mb-4 flex items-center gap-4">
                                        Tracking Questions?
                                        <HelpCircle className="text-rust" size={24} />
                                    </h3>
                                    <div className="h-1 w-12 bg-secondary mt-2 rounded-full" />
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
                                            text: `Reach out to our support team at support@petposture.com or call us directly at ${contact.phone || "+1 (916) 623-5368"}.`
                                        }
                                    ].map((item, idx) => (
                                        <motion.div key={idx} variants={fadeUp} className="flex gap-6 group">
                                            <div className="w-14 h-14 rounded-2xl bg-[#f8f9fa] flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-ink transition-all duration-300 flex-shrink-0 shadow-sm">
                                                <item.icon size={26} strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <h4 className="text-[17px] font-bold text-primary mb-2 group-hover:text-rust transition-colors">{item.title}</h4>
                                                <p className="text-zinc-500 text-[15px] leading-relaxed">{item.text}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <motion.div variants={fadeUp} className="mt-16 p-8 bg-secondary-light rounded-3xl text-primary relative overflow-hidden border border-orange-100/50">
                                    <div className="relative z-10">
                                        <h4 className="text-[18px] font-bold mb-4">Quality Guarantee</h4>
                                        <p className="text-zinc-600 text-[14px] leading-relaxed mb-6">
                                            Every PetPosture product undergoes rigorous quality checks before leaving our facility to ensure your pet receives only the best.
                                        </p>
                                        <Link href="/contact" className="text-rust font-bold uppercase tracking-widest text-sm flex items-center gap-2 hover:text-primary transition-colors">
                                            Contact Support <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Background Decorative Elements */}
                    <div className="absolute top-40 right-[-10%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />
                    <div className="absolute bottom-20 left-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
                </section>

                {/* Return Link Footer */}
                <section className="py-16 bg-zinc-50">
                    <div className="max-w-[1200px] mx-auto px-4 text-center">
                        <Link href="/" className="inline-flex items-center gap-3 text-primary/40 hover:text-rust font-bold uppercase tracking-[0.25em] text-sm transition-all">
                            <ArrowLeft size={16} /> Back to Homepage
                        </Link>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
