"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CookieConsentModal } from "./CookieConsentModal";
import { getConsent, hasGpcSignal, saveConsent } from "@/lib/cookieConsent";

export function CookieBanner() {
    const [visible, setVisible] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        if (getConsent()) return;

        if (hasGpcSignal()) {
            saveConsent({ analytics: false, method: "gpc" });
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only check after mount; required to avoid SSR/localStorage hydration mismatch
        setVisible(true);
    }, []);

    const acceptAll = () => {
        saveConsent({ analytics: true, method: "accept_all" });
        setVisible(false);
    };

    const savePreferences = (analytics: boolean) => {
        saveConsent({ analytics, method: "customize" });
        setModalOpen(false);
        setVisible(false);
    };

    return (
        <>
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#1a2128] text-white border-t border-white/10 px-4 py-5 md:px-8"
                    >
                        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                            <p className="text-[14px] text-white/70 leading-relaxed flex-1 text-center sm:text-left">
                                We use cookies to measure traffic and improve your experience. See our{" "}
                                <Link href="/cookie-policy" className="text-secondary hover:underline">
                                    Cookie Policy
                                </Link>
                                .
                            </p>
                            <div className="flex shrink-0 items-center gap-3">
                                <button
                                    onClick={() => setModalOpen(true)}
                                    className="bg-transparent border border-white/20 hover:border-white/40 text-white text-[14px] font-bold uppercase tracking-wider px-5 py-3 rounded-lg transition-colors"
                                >
                                    Customize
                                </button>
                                <button
                                    onClick={acceptAll}
                                    className="bg-white hover:bg-white/90 text-[#1a2128] text-[14px] font-bold uppercase tracking-wider px-5 py-3 rounded-lg transition-colors"
                                >
                                    Accept All
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CookieConsentModal
                open={modalOpen}
                initialAnalytics={false}
                onClose={() => setModalOpen(false)}
                onSave={savePreferences}
            />
        </>
    );
}
