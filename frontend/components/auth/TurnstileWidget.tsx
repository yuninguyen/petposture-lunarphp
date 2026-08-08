"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, unknown>) => string;
            remove: (widgetId: string) => void;
        };
    }
}

type TurnstileWidgetProps = {
    onVerify: (token: string) => void;
    onExpire?: () => void;
};

export function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useEffect(() => {
        onVerifyRef.current = onVerify;
        onExpireRef.current = onExpire;
    });

    // next/script only fires onLoad once per unique src for the whole app
    // session — if this widget remounts (e.g. switching Sign In/Register)
    // after the script already loaded elsewhere, onLoad never fires again.
    // Poll for window.turnstile directly so remounts pick it up immediately.
    useEffect(() => {
        if (window.turnstile) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time check for an already-loaded external script on mount/remount
            setScriptLoaded(true);
            return;
        }

        const interval = setInterval(() => {
            if (window.turnstile) {
                setScriptLoaded(true);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!scriptLoaded || !siteKey || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => onVerifyRef.current(token),
            'expired-callback': () => onExpireRef.current?.(),
        });

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
            }
        };
    }, [scriptLoaded, siteKey]);

    if (!siteKey) return null;

    return (
        <>
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
                onLoad={() => setScriptLoaded(true)}
            />
            <div ref={containerRef} />
        </>
    );
}
