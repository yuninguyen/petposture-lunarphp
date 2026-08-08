"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";

type CookieConsentModalProps = {
    open: boolean;
    initialAnalytics: boolean;
    onClose: () => void;
    onSave: (analytics: boolean) => void;
};

export function CookieConsentModal({ open, initialAnalytics, onClose, onSave }: CookieConsentModalProps) {
    const [analytics, setAnalytics] = useState(initialAnalytics);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-[560px] rounded-2xl bg-white p-6 md:p-8 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cookie-preferences-title"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <h2 id="cookie-preferences-title" className="text-[20px] font-bold text-[#3e4c57]">
                                Cookie Preferences
                            </h2>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="text-zinc-400 hover:text-[#3e4c57] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-[14px] text-zinc-500 leading-relaxed mb-6">
                            Choose which categories of cookies you allow. See our{" "}
                            <Link href="/cookie-policy" className="text-[#df8448] hover:underline">
                                Cookie Policy
                            </Link>{" "}
                            for details on what each category does.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                                <div>
                                    <p className="text-[14px] font-bold text-[#3e4c57]">Essential</p>
                                    <p className="text-[13px] text-zinc-500 mt-1">
                                        Required to keep your cart and account signed in. Cannot be disabled.
                                    </p>
                                </div>
                                <span className="shrink-0 mt-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border border-zinc-200 rounded-full px-2.5 py-1">
                                    Always on
                                </span>
                            </div>

                            <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-100 p-4">
                                <div>
                                    <p className="text-[14px] font-bold text-[#3e4c57]">Analytics</p>
                                    <p className="text-[13px] text-zinc-500 mt-1">
                                        Helps us understand site traffic via Google Analytics. Off by default.
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={analytics}
                                    aria-label="Toggle analytics cookies"
                                    onClick={() => setAnalytics((v) => !v)}
                                    className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${analytics ? "bg-[#df8448]" : "bg-zinc-300"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${analytics ? "translate-x-5" : "translate-x-0"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                            <button
                                onClick={() => onSave(false)}
                                className="flex-1 border border-zinc-200 text-[#3e4c57] text-[14px] font-bold uppercase tracking-wider px-6 py-3 rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                                Reject Non-Essential
                            </button>
                            <button
                                onClick={() => onSave(analytics)}
                                className="flex-1 bg-[#df8448] hover:bg-[#c9713a] text-white text-[14px] font-bold uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
                            >
                                Save Preferences
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
