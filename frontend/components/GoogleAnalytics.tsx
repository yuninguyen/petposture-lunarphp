"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, getConsent } from "@/lib/cookieConsent";

declare global {
    interface Window {
        dataLayer?: unknown[][];
    }
}

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const check = () => setAllowed(getConsent()?.analytics === true);

        check();
        window.addEventListener(CONSENT_CHANGED_EVENT, check);
        return () => window.removeEventListener(CONSENT_CHANGED_EVENT, check);
    }, []);

    useEffect(() => {
        if (!allowed) return;

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(["js", new Date()]);
        window.dataLayer.push(["config", measurementId]);
    }, [allowed, measurementId]);

    if (!allowed) return null;

    return (
        <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="lazyOnload"
        />
    );
}
