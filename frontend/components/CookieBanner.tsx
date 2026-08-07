"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-notice-dismissed";

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only check after mount; required to avoid SSR/localStorage hydration mismatch
                setVisible(true);
            }
        } catch { }
    }, []);

    const dismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch { }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] bg-primary text-white border-t border-white/10 px-4 py-5 md:px-8">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <p className="text-[14px] text-white/70 leading-relaxed flex-1 text-center sm:text-left">
                    We use cookies that are essential to running this Site, such as keeping your cart and account signed in. By continuing to browse, you agree to this use. See our{" "}
                    <Link href="/cookie-policy" className="text-[#df8448] hover:underline">
                        Cookie Policy
                    </Link>{" "}
                    to learn more.
                </p>
                <button
                    onClick={dismiss}
                    className="shrink-0 bg-[#df8448] hover:bg-[#c9713a] text-white text-[14px] font-bold uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
