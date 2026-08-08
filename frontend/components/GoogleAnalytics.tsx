"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, getConsent } from "@/lib/cookieConsent";

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const check = () => setAllowed(getConsent()?.analytics === true);

        check();
        window.addEventListener(CONSENT_CHANGED_EVENT, check);
        return () => window.removeEventListener(CONSENT_CHANGED_EVENT, check);
    }, []);

    if (!allowed) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${measurementId}');
                `}
            </Script>
        </>
    );
}
