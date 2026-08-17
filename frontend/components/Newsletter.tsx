"use client";

import { useState } from "react";
import { MailOpen, Lock, Ban, Tag } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-secondary-light px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary/15">
            <MailOpen size={24} className="text-secondary" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="mb-1.5 text-[20px] font-bold text-primary">
              Better recommendations for your dog.
            </h2>
            <p className="max-w-[380px] text-sm leading-relaxed text-primary/60">
              Get breed-focused guides, product updates and 10% off your first PetPosture order.
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 md:max-w-[460px]">
          {!submitted ? (
            <>
              <form
                onSubmit={handleSubmit}
                className={`flex flex-col gap-2 rounded-[4px] border bg-white p-1 transition-all duration-300 sm:flex-row sm:gap-0 sm:p-[4px] ${isFocused
                    ? "border-secondary shadow-[0_10px_32px_-4px_rgba(223,132,72,0.2)]"
                    : "border-zinc-200 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
                  }`}
              >
                <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  required
                  disabled={isSubmitting}
                  className="flex-1 border-none bg-transparent px-[18px] py-3.5 text-sm text-primary outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="whitespace-nowrap rounded-[2px] bg-secondary px-6 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-ink transition-colors hover:bg-secondary-dark disabled:opacity-60 sm:py-0"
                >
                  {isSubmitting ? "Subscribing…" : "Join & Get 10% Off"}
                </button>
              </form>
              {error && (
                <p className="mt-2.5 text-[13px] font-bold text-red-600">{error}</p>
              )}
              <div className="mt-3 flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-xs text-primary/60 sm:justify-start sm:text-left">
                <span className="flex items-center gap-1.5"><Lock size={13} /> No spam ever</span>
                <span className="flex items-center gap-1.5"><Ban size={13} /> Unsubscribe anytime</span>
                <span className="flex items-center gap-1.5"><Tag size={13} /> Exclusive offers</span>
              </div>
            </>
          ) : (
            <div className="rounded-[4px] border border-[#38c68b40] bg-white px-6 py-[18px]">
              <p className="mb-1 text-[15px] font-bold text-primary">🎉 You&apos;re in! Check your inbox.</p>
              <p className="text-[13px] text-primary/60">Your 10% discount code is on its way.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
