"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;

    setStatus("loading");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
      setMessage(data?.message || "Successfully subscribed!");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="py-24 px-4 md:px-8 bg-white border-b border-zinc-50 overflow-hidden">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Text Area */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-[0.2em] text-primary mb-4 leading-tight">
              Get 10% Off <br className="hidden md:block" /> Your First <br className="hidden md:block" /> Order
            </h2>
            <p className="text-md font-black uppercase tracking-[0.3em] text-primary/30 max-w-sm mx-auto md:mx-0">
              Join our pack and get exclusive deals, posture tips, and early access.
            </p>
          </div>

          {/* Form Area */}
          <div className="w-full max-w-md">
            <form className="flex flex-col gap-3 group" noValidate onSubmit={handleSubmit}>
              <div className="relative">
                <label htmlFor="nl-email" className="sr-only">Email address</label>
                <input
                  id="nl-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address…"
                  autoComplete="email"
                  required
                  disabled={status === "loading" || status === "success"}
                  spellCheck={false}
                  className="w-full border-b-2 border-zinc-100 py-4 px-1 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-secondary transition-all bg-transparent placeholder:text-zinc-200 disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="bg-secondary hover:bg-primary text-white px-8 py-4 font-black text-sm uppercase tracking-[0.25em] transition-all shadow-xl hover:-translate-y-1 active:scale-95 whitespace-nowrap disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {status === "loading" ? "Subscribing…" : status === "success" ? "Subscribed" : "Subscribe"}
              </button>
            </form>

            {message && (
              <p className={`mt-3 text-xs font-bold uppercase tracking-[0.1em] text-center md:text-left ${status === "error" ? "text-red-500" : "text-secondary"}`}>
                {message}
              </p>
            )}

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-primary/20 text-center md:text-left leading-relaxed">
              By subscribing you agree to our{" "}
              <a href="/privacy-policy" className="underline hover:text-primary transition-colors">Privacy Policy</a>
              . Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
