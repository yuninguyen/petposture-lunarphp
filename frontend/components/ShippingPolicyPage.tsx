"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const SECTIONS = [
    { id: "processing", title: "1. ORDER PROCESSING TIME" },
    { id: "shipping-time", title: "2. SHIPPING TIME & ZONES" },
    { id: "rates", title: "3. SHIPPING RATES" },
    { id: "tracking", title: "4. TRACKING & WAREHOUSES" },
    { id: "contact", title: "5. CONTACT INFORMATION" },
    { id: "faq", title: "6. FREQUENTLY ASKED QUESTIONS" },
];

export default function ShippingPolicyPage() {
    const [activeSection, setActiveSection] = useState("");
    const [openFaq, setOpenFaq] = useState<number | null>(1); // Open the shipping time faq by default to match screenshot

    const faqItems = [
        {
            id: 0,
            question: "Why did I only receive part of my order?",
            answer: "PetPosture partners with specialized manufacturers and warehouses across the US. Because of this, your items may be shipped from different locations and arrive at different times in separate packages. Each package will have its own tracking number."
        },
        {
            id: 1,
            question: "How long will it really take to get my order?",
            answer: "Please allow 2-4 business days for processing plus 3-8 business days for shipping. In total, most customers receive their order within 7-10 business days."
        },
        {
            id: 2,
            question: "Do you ship to Alaska, Hawaii, or P.O. Boxes?",
            answer: "Currently, we only ship to the 48 contiguous United States. We do not ship to Alaska, Hawaii, P.O. Boxes, or APO/FPO addresses."
        }
    ];

    useEffect(() => {
        const handleScroll = () => {
            const offsets = SECTIONS.map(s => {
                const el = document.getElementById(s.id);
                return el ? { id: s.id, offset: el.offsetTop } : null;
            }).filter(Boolean) as { id: string; offset: number }[];

            const scrollPos = window.scrollY + 150;
            const current = offsets.reverse().find(o => scrollPos >= o.offset);
            if (current) setActiveSection(current.id);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({
                top: el.offsetTop - 100,
                behavior: 'smooth'
            });
        }
    };

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            {/* Hero Section */}
            <section className="bg-[#f4f5f6] py-16 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeUp}
                    >
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-[#3e4c57] mb-4">
                            Shipping Policy
                        </h1>
                        <p className="text-[#666666] text-[15px] font-medium tracking-wide">
                            Last updated: November 9, 2025
                        </p>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mt-6"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Sidebar Table of Contents (Desktop) */}
                    <aside className="hidden lg:block w-80 sticky top-32 h-fit">
                        <h4 className="text-[14px] font-bold uppercase tracking-widest text-[#3e4c57] mb-8 border-b border-zinc-100 pb-4">
                            Table of Contents
                        </h4>
                        <nav className="flex flex-col gap-4">
                            {SECTIONS.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => scrollTo(s.id)}
                                    className={`text-left text-[13px] font-bold uppercase tracking-wider transition-all hover:text-[#df8448] ${activeSection === s.id ? 'text-[#df8448] pl-2 border-l-2 border-[#df8448]' : 'text-[#666666]'
                                        }`}
                                >
                                    {s.title}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <div className="flex-1 max-w-[800px]">
                        <div className="prose prose-zinc max-w-none text-[#4a4a4a] text-[16px] leading-[1.8]">
                            <div className="space-y-12">
                                <section id="processing">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">1. ORDER PROCESSING TIME</h2>
                                    <p>
                                        At PetPosture, we strive to get your orders ready as quickly as possible. All orders are processed and prepared for shipment within **2 – 4 business days** (Monday – Friday, excluding public holidays) after your order is confirmed.
                                    </p>
                                    <p className="mt-4 italic text-[#666666]">
                                        Please note: Processing time is in addition to the transit time required for delivery.
                                    </p>
                                </section>

                                <section id="shipping-time">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">2. SHIPPING TIME & ZONES</h2>
                                    <p>
                                        Currently, PetPosture ships exclusively to the **48 contiguous United States**. We do not ship to Alaska, Hawaii, P.O. Boxes, or APO/FPO addresses at this time.
                                    </p>
                                    <ul className="list-disc pl-6 space-y-4 mt-6">
                                        <li>
                                            <strong>Transit Time:</strong> Typically **3 – 8 business days** for domestic shipping within the US.
                                        </li>
                                        <li>
                                            <strong>Total Estimated Delivery:</strong> You can expect your ergonomic pet essentials to arrive within **7 – 10 business days** from the date of your order.
                                        </li>
                                    </ul>
                                </section>

                                <section id="rates">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">3. SHIPPING RATES</h2>
                                    <p>
                                        Shipping costs are calculated dynamically at checkout based on the total weight of the items in your cart and the specific delivery destination. We work with major carriers to ensure common-sense pricing and safe delivery of your products.
                                    </p>
                                </section>

                                <section id="tracking">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">4. TRACKING & WAREHOUSES</h2>
                                    <p>
                                        As soon as your package leaves our warehouse, we will send you a shipping confirmation email containing a tracking number so you can follow its journey.
                                    </p>
                                    <p className="mt-6">
                                        <strong>Multiple Shipments:</strong> Because PetPosture partners with specialized manufacturers and warehouses across the US to ensure the best quality, your order might arrive in separate packages. Each package will have its own tracking number if shipped separately.
                                    </p>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">5. CONTACT INFORMATION</h2>
                                    <p>Our dedicated support team is here to help with any shipping-related questions or concerns:</p>
                                    <div className="mt-6 bg-[#f8f9fa] p-8 rounded-xl space-y-3">
                                        <p><strong>Email:</strong> <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a></p>
                                        <p><strong>Phone:</strong> +1 (916) 668-0065</p>
                                        <p><strong>Operating Hours:</strong> 10:00 AM – 20:00 PM (Monday – Friday)</p>
                                        <p className="pt-4 text-[14px] text-[#666666]">
                                            PetPosture LLC<br />
                                            2017 I STA, Sacramento, CA 95811
                                        </p>
                                    </div>
                                </section>

                                {/* FAQ Section */}
                                <section id="faq" className="pt-10 scroll-mt-32 pb-12">
                                    <div className="text-center mb-10">
                                        <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">
                                            Frequently Asked Questions
                                        </h2>
                                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                                    </div>

                                    <div className="space-y-0">
                                        {faqItems.map((item) => (
                                            <div key={item.id} className="border-b border-zinc-100 last:border-none">
                                                <button
                                                    onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                                                    className="flex items-center justify-between w-full py-4 text-left group"
                                                >
                                                    <span className={`text-[16px] md:text-[18px] font-medium transition-colors ${openFaq === item.id ? 'text-[#df8448]' : 'text-[#3e4c57]'
                                                        }`}>
                                                        {item.question}
                                                    </span>
                                                    <ChevronDown
                                                        size={20}
                                                        className={`text-zinc-400 transition-transform duration-300 ${openFaq === item.id ? 'rotate-180 text-[#df8448]' : ''
                                                            }`}
                                                    />
                                                </button>
                                                <AnimatePresence>
                                                    {openFaq === item.id && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="pb-6 text-[16px] text-[#666666] leading-relaxed">
                                                                {item.answer}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
