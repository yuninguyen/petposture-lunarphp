"use client";

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS (Synced with HomePage.tsx)
  ───────────────────────────────────────────────────────────────── */
const C = {
    primary: '#3e4c57',
    primaryHover: '#2c3840',
    secondary: '#df8448',
    secondaryHover: '#c9713a',
    secondaryLight: '#fdf2ea',
    white: '#ffffff',
    grayLight: '#f4f5f6',
    grayMid: '#e8eaec',
    grayText: '#6b7280',
    border: '#e2e5e8',
    borderHover: '#c8cdd2',
};

const F = {
    heading: "var(--font-hanken), sans-serif",
    body: "var(--font-hanken), sans-serif",
    nav: "var(--font-lato), sans-serif",
    alt: "var(--font-dancing), cursive",
};

/* ─────────────────────────────────────────────────────────────────
   SHARED UI COMPONENTS
  ───────────────────────────────────────────────────────────────── */
function ContactInfoItem({ icon: Icon, label, value, href, note }: { icon: React.ElementType, label: string, value: string, href?: string, note?: string }) {
    const content = (
        <div className="flex items-start gap-4 p-5 rounded-lg border border-zinc-100 bg-white hover:border-[#df8448]/30 transition-all duration-300 group shadow-sm hover:shadow-md h-full">
            <div className="w-12 h-12 rounded-full bg-[#df8448]/5 flex items-center justify-center text-[#df8448] group-hover:bg-[#df8448] group-hover:text-white transition-all shrink-0">
                <Icon size={20} />
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#df8448] mb-1">{label}</p>
                <p className="text-[15px] font-bold text-[#3e4c57] leading-tight">{value}</p>
                {note && (
                    <p className="text-[12px] text-zinc-400 mt-1 font-medium italic">
                        ({note})
                    </p>
                )}
            </div>
        </div>
    );

    return href ? <a href={href} className="block no-underline">{content}</a> : content;
}

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        orderNumber: '',
        subject: '',
        message: ''
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        // Simulate API call
        setTimeout(() => {
            setStatus('success');
            setFormData({ name: '', email: '', orderNumber: '', subject: '', message: '' });
        }, 1500);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-white flex flex-col font-sans">
                <Header />
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-widest text-[#3e4c57]">Message Sent!</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed tracking-wide">
                            Thank you for reaching out to the PetPosture pack. We&apos;ve received your request and our support specialists will get back to you within 24 business hours.
                        </p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="bg-[#df8448] text-white px-10 py-4 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-[#3e4c57] transition-all transform hover:-translate-y-1 shadow-lg"
                        >
                            Send Another message
                        </button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            <Header />

            {/* Hero Section - Clean & High-End */}
            <section className="bg-[#f4f5f6] py-12 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <div className="inline-block px-4 py-1.5 bg-[#df8448]/5 border border-[#df8448]/20 rounded text-[10px] font-black uppercase tracking-[0.25em] text-[#df8448] mb-6">
                        Get in touch
                    </div>
                    <h1 className="text-[32px] md:text-[48px] font-black uppercase tracking-[0.1em] text-[#3e4c57] mb-6 leading-tight">
                        How Can We Help <br className="hidden md:block" /> Your Pack Today?
                    </h1>
                    <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                    <p className="text-[18px] text-zinc-500 max-w-xl mx-auto leading-relaxed font-medium">
                        Have a question about ergonomics, order tracking, or breed-specific needs?
                        Our PetPosture specialists are here to ensure your pet gets the support they deserve.
                    </p>
                </div>
            </section>

            {/* Main Content: Form & Info */}
            <section className="py-20 px-4 md:px-8 bg-white relative overflow-hidden">
                {/* Subtle Brand Background Accents */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#df8448]/[0.03] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#3e4c57]/[0.03] rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 -z-10" />

                <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

                    {/* Left Side: Contact Form (7 cols) */}
                    <div className="lg:col-span-7 bg-white p-8 md:p-12 rounded-2xl border border-zinc-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
                        <div className="mb-10">
                            <h3 className="text-2xl font-black uppercase tracking-widest text-[#3e4c57] mb-3">Send Us a Message</h3>
                            <p className="text-[13px] text-zinc-400 font-medium">We typically respond to all inquiries within 24 business hours.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Full Name */}
                                <div className="relative group">
                                    <label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3e4c57]/40 mb-2 block transition-colors group-focus-within:text-[#df8448]">Full Name</label>
                                    <input
                                        required
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="Enter your name"
                                        className="w-full border-b-2 border-zinc-100 py-3 text-[13px] font-bold transition-all focus:outline-none focus:border-[#df8448] bg-transparent text-[#3e4c57] placeholder:text-zinc-200"
                                    />
                                </div>

                                {/* Email Address */}
                                <div className="relative group">
                                    <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3e4c57]/40 mb-2 block transition-colors group-focus-within:text-[#df8448]">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="example@pack.com"
                                        className="w-full border-b-2 border-zinc-100 py-3 text-[13px] font-bold transition-all focus:outline-none focus:border-[#df8448] bg-transparent text-[#3e4c57] placeholder:text-zinc-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Order Number */}
                                <div className="relative group">
                                    <label htmlFor="orderNumber" className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3e4c57]/40 mb-2 block transition-colors group-focus-within:text-[#df8448]">Order Number (Optional)</label>
                                    <input
                                        type="text"
                                        id="orderNumber"
                                        name="orderNumber"
                                        value={formData.orderNumber}
                                        onChange={handleInputChange}
                                        placeholder="#PP-12345"
                                        className="w-full border-b-2 border-zinc-100 py-3 text-[13px] font-bold transition-all focus:outline-none focus:border-[#df8448] bg-transparent text-[#3e4c57] placeholder:text-zinc-200"
                                    />
                                </div>

                                {/* Subject */}
                                <div className="relative group">
                                    <label htmlFor="subject" className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3e4c57]/40 mb-2 block transition-colors group-focus-within:text-[#df8448]">Subject / Inquiry Type</label>
                                    <input
                                        required
                                        type="text"
                                        id="subject"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleInputChange}
                                        placeholder="How can we help?"
                                        className="w-full border-b-2 border-zinc-100 py-3 text-[13px] font-bold transition-all focus:outline-none focus:border-[#df8448] bg-transparent text-[#3e4c57] placeholder:text-zinc-200"
                                    />
                                </div>
                            </div>

                            {/* Message */}
                            <div className="relative group">
                                <label htmlFor="message" className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3e4c57]/40 mb-2 block transition-colors group-focus-within:text-[#df8448]">Your Message</label>
                                <textarea
                                    required
                                    id="message"
                                    name="message"
                                    rows={4}
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    placeholder="Write your message here..."
                                    className="w-full border-b-2 border-zinc-100 py-3 text-[13px] font-bold transition-all focus:outline-none focus:border-[#df8448] bg-transparent text-[#3e4c57] placeholder:text-zinc-200 resize-none"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full md:w-auto bg-[#df8448] hover:bg-[#c9713a] text-white px-12 py-5 font-black text-[12px] uppercase tracking-[0.25em] transition-all transform hover:-translate-y-1 active:scale-95 shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {status === 'loading' ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Submit Message <Send size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Right Side: Contact Info (5 cols) */}
                    <div className="lg:col-span-5 lg:pt-12">
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-widest text-[#3e4c57] mb-6">Contact Details</h3>
                                <div className="space-y-4">
                                    <ContactInfoItem
                                        icon={Mail}
                                        label="Email Us"
                                        value="support@petposture.com"
                                        href="mailto:support@petposture.com"
                                    />
                                    <ContactInfoItem
                                        icon={Phone}
                                        label="Call Us"
                                        value="+1 (916) 668-0065"
                                        href="tel:19166680065"
                                    />
                                    <ContactInfoItem
                                        icon={MapPin}
                                        label="Our Office"
                                        value="2017 I St A, Sacramento,CA 95811, United States"
                                        note="This is not retail location"
                                        href="https://maps.app.goo.gl/B9HUyLdTnm4etSrL9"
                                    />
                                </div>
                            </div>

                            {/* Quick Question Section */}
                            <div className="p-8 bg-[#3e4c57] rounded-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                                <h4 className="text-white text-lg font-black uppercase tracking-widest mb-4">Have a Quick Question?</h4>
                                <p className="text-white/60 text-[13px] leading-relaxed mb-6">
                                    Many common questions about shipping, returns, and breed-specific fits are answered in our Help Center.
                                </p>
                                <Link href="/faqs" className="inline-flex items-center gap-2 text-[#df8448] font-black text-[11px] uppercase tracking-widest hover:text-white transition-colors group">
                                    Visit Help Center <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Elements / Band */}
            <section className="py-12 border-t border-zinc-50 bg-[#fafbfc]">
                <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap justify-center gap-x-16 gap-y-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                    {/* Placeholder for Trust Badges/Logos if needed */}
                </div>
            </section>

            <Footer />
        </div>
    );
}
