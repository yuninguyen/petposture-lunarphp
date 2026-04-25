"use client";

import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

declare global {
    interface Window {
        Stripe?: (publishableKey: string) => {
            elements: () => {
                create: (
                    type: "card",
                    options?: Record<string, unknown>
                ) => {
                    mount: (element: string | HTMLElement) => void;
                    unmount: () => void;
                    destroy: () => void;
                };
            };
            confirmCardPayment: (
                clientSecret: string,
                data: Record<string, unknown>
            ) => Promise<{
                error?: { message?: string };
                paymentIntent?: { status?: string };
            }>;
        };
    }
}

type PreparedPaymentIntent = {
    intent_id: string;
    client_secret: string;
    amount: number;
    currency: string;
    status: string;
    mode: string;
    gateway: string;
    publishable_key?: string | null;
};

const stripeJsScriptId = "petposture-stripe-js";

export default function RetryPaymentPanel({
    reference,
    email,
    customerName,
    paymentMethod,
    paymentStatus,
    orderStatus,
    onCompleted,
}: {
    reference: string;
    email: string;
    customerName: string;
    paymentMethod: string | null;
    paymentStatus: string;
    orderStatus: string;
    onCompleted?: () => void;
}) {
    const eligible = paymentMethod === "card" && !["paid", "cancelled"].includes(paymentStatus) && orderStatus !== "cancelled";
    const [intent, setIntent] = useState<PreparedPaymentIntent | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [stripeReady, setStripeReady] = useState(false);
    const stripeMountRef = useRef<HTMLDivElement | null>(null);
    const stripeInstanceRef = useRef<ReturnType<NonNullable<typeof window.Stripe>> | null>(null);
    const stripeElementsRef = useRef<ReturnType<ReturnType<NonNullable<typeof window.Stripe>>["elements"]> | null>(null);
    const stripeCardElementRef = useRef<ReturnType<ReturnType<ReturnType<NonNullable<typeof window.Stripe>>["elements"]>["create"]> | null>(null);

    useEffect(() => {
        if (!intent || intent.mode !== "configured" || !intent.publishable_key || typeof window === "undefined") {
            return;
        }

        const initialiseStripe = () => {
            if (!window.Stripe || !intent.publishable_key) {
                setError("Stripe.js could not be loaded for payment retry.");
                return;
            }

            stripeInstanceRef.current = window.Stripe(intent.publishable_key);
            stripeElementsRef.current = stripeInstanceRef.current.elements();
            setStripeReady(true);
        };

        if (window.Stripe) {
            initialiseStripe();
            return;
        }

        const existingScript = document.getElementById(stripeJsScriptId) as HTMLScriptElement | null;

        if (existingScript) {
            existingScript.addEventListener("load", initialiseStripe, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = stripeJsScriptId;
        script.async = true;
        script.src = "https://js.stripe.com/v3/";
        script.addEventListener("load", initialiseStripe, { once: true });
        document.head.appendChild(script);
    }, [intent]);

    useEffect(() => {
        if (!intent || intent.mode !== "configured" || !stripeReady || !stripeElementsRef.current || !stripeMountRef.current) {
            return;
        }

        stripeCardElementRef.current?.unmount();
        stripeCardElementRef.current?.destroy();

        const cardElement = stripeElementsRef.current.create("card", {
            style: {
                base: {
                    color: "#1f2937",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    "::placeholder": {
                        color: "#9ca3af",
                    },
                },
            },
        });

        cardElement.mount(stripeMountRef.current);
        stripeCardElementRef.current = cardElement;

        return () => {
            stripeCardElementRef.current?.unmount();
            stripeCardElementRef.current?.destroy();
            stripeCardElementRef.current = null;
        };
    }, [intent, stripeReady]);

    if (!eligible) {
        return null;
    }

    const handlePrepareRetry = async () => {
        setIsPreparing(true);
        setError(null);
        setMessage(null);

        try {
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/orders/retry-payment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tracking_number: reference,
                    email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || "Could not prepare a new payment attempt.");
            }

            const nextIntent = data.payment_intent as PreparedPaymentIntent;
            setIntent(nextIntent);
            setMessage(
                nextIntent.mode === "configured"
                    ? "A new secure payment attempt is ready. Enter your card details below."
                    : "A retry intent was prepared, but live Stripe keys are not configured yet."
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not prepare a new payment attempt.");
        } finally {
            setIsPreparing(false);
        }
    };

    const handleConfirmRetry = async () => {
        if (!intent || intent.mode !== "configured" || !stripeInstanceRef.current || !stripeCardElementRef.current) {
            return;
        }

        setIsConfirming(true);
        setError(null);

        try {
            const confirmation = await stripeInstanceRef.current.confirmCardPayment(intent.client_secret, {
                payment_method: {
                    card: stripeCardElementRef.current,
                    billing_details: {
                        name: customerName || undefined,
                        email,
                    },
                },
            });

            if (confirmation.error?.message) {
                throw new Error(confirmation.error.message);
            }

            const status = confirmation.paymentIntent?.status;

            if (status === "succeeded") {
                setMessage("Payment confirmed successfully. Refreshing the latest order status...");
                onCompleted?.();
            } else if (status === "processing") {
                setMessage("Payment is processing. We'll refresh the order status shortly.");
                onCompleted?.();
            } else if (status === "requires_action") {
                setMessage("Stripe requested additional authentication to finish this payment.");
            } else if (status) {
                setMessage(`Stripe returned status: ${status}.`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Payment retry failed.");
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="rounded-[10px] border border-[#e8e8ea] bg-white">
            <div className="border-b border-[#f3f3f5] px-6 py-4">
                <h2 className="text-[14px] font-semibold text-[#1a1a1a]">
                    Retry payment
                </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
                <p className="text-[13px] leading-[1.7] text-[#707070]">
                    Your order is still awaiting card payment. You can start a new secure payment attempt here.
                </p>

                {!intent ? (
                    <button
                        type="button"
                        onClick={handlePrepareRetry}
                        disabled={isPreparing}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#df8448] px-5 text-[13px] font-semibold text-white transition hover:bg-[#c9713a] disabled:opacity-60"
                    >
                        {isPreparing ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                        {isPreparing ? "Preparing..." : "Retry card payment"}
                    </button>
                ) : null}

                {intent?.mode === "configured" ? (
                    <div className="space-y-3 rounded-[8px] border border-[#d9d9d9] bg-[#faf9f8] p-4">
                        <div className="rounded-[8px] border border-[#d9d9d9] bg-white px-3.5 py-[15px]">
                            <div ref={stripeMountRef} />
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirmRetry}
                            disabled={!stripeReady || isConfirming}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60"
                        >
                            {isConfirming ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                            {isConfirming ? "Confirming..." : "Confirm payment"}
                        </button>
                    </div>
                ) : null}

                {message ? (
                    <div className="rounded-[8px] border border-[#f4cdb7] bg-[#fff7f2] px-4 py-3 text-[12.5px] leading-6 text-[#8a5a34]">
                        {message}
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-[8px] border border-[#f0d4d4] bg-[#fff5f5] px-4 py-3 text-[12.5px] leading-6 text-[#b24a4a]">
                        {error}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
