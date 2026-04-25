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
    { id: "window", title: "1. RETURN WINDOW & REPORTING" },
    { id: "rma", title: "2. RMA REQUIREMENT" },
    { id: "conditions", title: "3. RETURN CONDITIONS" },
    { id: "fees", title: "4. COSTS AND FEES" },
    { id: "refund-process", title: "5. REFUND PROCESS" },
    { id: "logistics", title: "6. LOGISTICS & CONTACT" },
    { id: "faq", title: "7. FREQUENTLY ASKED QUESTIONS" },
];

export default function ReturnRefundPolicyPage() {
    const [activeSection, setActiveSection] = useState("");
    const [openFaq, setOpenFaq] = useState<number | null>(2); // Open the 'different brands' faq by default to match screenshot

    const faqItems = [
        {
            id: 0,
            question: "What is a 25% restocking fee?",
            answer: "The restocking fee covers the costs associated with processing a return, including inspection, professional cleaning, and repackaging by our suppliers to maintain hygiene standards for pet gear."
        },
        {
            id: 1,
            question: "Why do I have to pay for return shipping?",
            answer: "For returns due to change of mind (buyer's remorse), customers are responsible for shipping costs. This helps us maintain competitive product prices for everyone. We cover shipping for defective or incorrect items reported within 7 days."
        },
        {
            id: 2,
            question: "How do I return items from different brands?",
            answer: "You must contact us for an RMA number. Because items ship from different warehouses, we will provide you with separate return addresses and RMA numbers for each item. Please do not send items back without authorization."
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
                            Return & Refund Policy
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
                                <section id="window">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">1. RETURN WINDOW & REPORTING</h2>
                                    <p>
                                        We want you and your pet to be completely satisfied with your purchase. If for any reason you are not, we offer a **30-day return window** from the date of delivery.
                                    </p>
                                    <div className="mt-6 bg-[#fff8f4] border-l-4 border-[#df8448] p-6">
                                        <p className="font-bold text-[#3e4c57]">Important regarding Damaged or Defective items:</p>
                                        <p className="mt-2 text-[#4a4a4a]">
                                            Any items that arrive damaged or defective must be reported to our support team within **7 days** of delivery. Reporting within this timeframe ensures you are eligible for pre-paid return shipping or direct reimbursement.
                                        </p>
                                    </div>
                                </section>

                                <section id="rma">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">2. RMA REQUIREMENT</h2>
                                    <p>
                                        To ensure a smooth process, all returns **must** have a **Return Merchandise Authorization (RMA)** number before being shipped back to our warehouses.
                                    </p>
                                    <p className="mt-4">
                                        Please do not ship items back without an authorized RMA number, as these shipments cannot be tracked by our system and will not be eligible for a refund. To obtain an RMA, please contact us at <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline font-medium">support@petposture.com</a>.
                                    </p>
                                </section>

                                <section id="conditions">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">3. RETURN CONDITIONS</h2>
                                    <p>To be eligible for a refund, returned items must meet the following criteria:</p>
                                    <ul className="list-disc pl-6 space-y-3 mt-6">
                                        <li>Must be in **original, new, and unused condition**.</li>
                                        <li>Must be free of **pet hair**, stains, odors, or any signs of use.</li>
                                        <li>Include all **original packaging, tags, and accessories**.</li>
                                        <li>Items damaged by the customer or missing original components are non-returnable.</li>
                                    </ul>
                                </section>

                                <section id="fees">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">4. COSTS AND FEES</h2>
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-[18px] font-bold text-[#3e4c57] mb-2">Restocking Fee</h3>
                                            <p>
                                                A **25% restocking fee** is charged on all returns. This fee covers the inspection, professional cleaning, and repackaging required by our suppliers to maintain hygiene standards for pet products.
                                            </p>
                                        </div>
                                        <div>
                                            <h3 className="text-[18px] font-bold text-[#3e4c57] mb-2">Shipping Costs</h3>
                                            <p>
                                                Original shipping charges are **non-refundable**.
                                            </p>
                                            <p className="mt-2">
                                                For &quot;Buyer&apos;s Remorse&quot; returns (e.g., changed mind, wrong size/color), the customer is responsible for the return shipping costs. For confirmed defective or incorrect items reported within 7 days, PetPosture will provide a pre-paid label.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section id="refund-process">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">5. REFUND PROCESS</h2>
                                    <p>
                                        Once your return is received at the designated supplier warehouse, it undergoes a thorough inspection which typically takes **3–5 business days**.
                                    </p>
                                    <p className="mt-4">
                                        Upon approval, your refund (minus the original shipping and the 25% restocking fee) will be processed back to your original payment method. Please note that it may take additional time for your bank or credit card company to post the refund to your statement.
                                    </p>
                                </section>

                                <section id="logistics">
                                    <h2 className="text-[24px] font-bold text-[#3e4c57] uppercase tracking-[0.1em] mb-6">6. LOGISTICS & CONTACT</h2>
                                    <p>
                                        Because PetPosture partners with specialized warehouses across the US, items from different categories may need to be returned to different locations.
                                    </p>
                                    <p className="mt-4 font-bold text-[#3e4c57]">Do not send returns to our Sacramento administrative office.</p>
                                    <p className="mt-4">
                                        We will provide you with the correct warehouse address during the RMA process. If you have any questions, please reach out:
                                    </p>
                                    <div className="mt-8 bg-[#f8f9fa] p-8 rounded-xl">
                                        <p><strong>Support Email:</strong> <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a></p>
                                        <p className="mt-2"><strong>Support Phone:</strong> +1 (916) 668-0065</p>
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
