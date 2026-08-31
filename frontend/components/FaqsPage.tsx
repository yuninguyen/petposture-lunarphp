"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageSquare } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CATEGORIES, FAQ_ITEMS } from '@/lib/faq-data';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function FaqsPage() {
    const [activeCategory, setActiveCategory] = useState("products");
    const [openItems, setOpenItems] = useState<number[]>([]);

    useEffect(() => {
        const handleScroll = () => {
            const offsets = CATEGORIES.map(c => {
                const el = document.getElementById(c.id);
                return el ? { id: c.id, offset: el.offsetTop } : null;
            }).filter(Boolean) as { id: string; offset: number }[];

            const scrollPos = window.scrollY + 200;
            const current = offsets.reverse().find(o => scrollPos >= o.offset);
            if (current) setActiveCategory(current.id);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleItem = (index: number) => {
        setOpenItems(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({
                top: el.offsetTop - 120,
                behavior: 'smooth'
            });
        }
    };

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            {/* Hero */}
            <section className="bg-gray-50 py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div initial="initial" animate="animate" variants={fadeUp}>
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-primary mb-6">
                            Frequently Asked Questions
                        </h1>
                        <p className="text-[#666666] text-[16px] max-w-2xl mx-auto leading-relaxed">
                            Find answers to common questions about our products, shipping, and return policies.
                        </p>
                        <div className="w-12 h-1 bg-secondary mx-auto rounded-full mt-8"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-12 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Sidebar TOC */}
                    <aside className="hidden lg:block w-72 sticky top-36 h-fit">
                        <h4 className="text-[14px] font-bold uppercase tracking-widest text-primary mb-8 opacity-40">
                            Jump to Category
                        </h4>
                        <nav className="flex flex-col gap-5">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => scrollTo(cat.id)}
                                    className={`text-left text-[14px] font-bold uppercase tracking-wider transition-all hover:text-rust ${activeCategory === cat.id ? 'text-rust pl-3 border-l-2 border-secondary' : 'text-primary/60 pl-3 border-l-2 border-transparent'
                                        }`}
                                >
                                    {cat.title}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* FAQ Content */}
                    <div className="flex-1 max-w-[800px]">
                        {CATEGORIES.map((cat) => (
                            <div key={cat.id} id={cat.id} className="mb-12 scroll-mt-36 last:mb-0">
                                <h2 className="text-[22px] font-medium text-primary uppercase tracking-[0.04em] mb-8 border-b border-zinc-100 pb-3">
                                    {cat.title}
                                </h2>
                                <div className="space-y-0">
                                    {FAQ_ITEMS.filter(item => item.category === cat.id).map((item) => {
                                        const globalIdx = FAQ_ITEMS.indexOf(item);
                                        const isOpen = openItems.includes(globalIdx);
                                        return (
                                            <div key={globalIdx} className="border-b border-zinc-50 last:border-none">
                                                <button
                                                    onClick={() => toggleItem(globalIdx)}
                                                    className="w-full flex items-center justify-between py-4 text-left group transition-all"
                                                >
                                                    <span className={`text-[17px] font-semibold transition-colors ${isOpen ? 'text-rust' : 'text-primary group-hover:text-rust'
                                                        }`}>
                                                        {item.question}
                                                    </span>
                                                    <ChevronDown
                                                        size={20}
                                                        className={`text-zinc-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-rust' : ''}`}
                                                    />
                                                </button>
                                                <AnimatePresence>
                                                    {isOpen && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="pb-6 text-[16px] text-[#666666] leading-relaxed pr-8">
                                                                {item.answer}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Contact CTA */}
                        <div className="mt-16 bg-[#f8f9fa] rounded-2xl p-10 text-center border border-zinc-100">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <MessageSquare className="text-rust" size={28} />
                            </div>
                            <h3 className="text-[22px] font-bold text-primary mb-4 uppercase tracking-widest">Still have questions?</h3>
                            <p className="text-[#666666] mb-8 max-w-md mx-auto text-[15px]">
                                Our friendly support team is here to help. We&apos;ll get back to you within 24 business hours.
                            </p>
                            <a
                                href="/contact"
                                className="inline-block bg-secondary text-ink px-10 py-4 rounded-[3px] border-2 border-secondary font-bold uppercase tracking-[0.15em] text-sm hover:bg-secondary-dark hover:border-secondary-dark transition-all"
                            >
                                Contact Support
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
