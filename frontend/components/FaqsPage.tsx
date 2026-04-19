"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageSquare } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const CATEGORIES = [
    { id: "products", title: "Product & Sizing" },
    { id: "shipping", title: "Shipping Information" },
    { id: "orders", title: "Orders & Returns" },
];

const FAQ_ITEMS = [
    {
        category: "products",
        question: "How do I know which product is right for my pet?",
        answer: "Every pet has unique needs. We recommend exploring our 'Shop by Breed' or 'Shop by Solution' collections. For example, our 'Mobility & Support' section is perfect for older pets needing extra help with furniture access, while 'Productivity' collection helps pets focus during mealtime."
    },
    {
        category: "products",
        question: "What's the difference between a Ramp and Stairs?",
        answer: "Ramps provide a gradual incline, making them the best choice for long-backed breeds like Dachshunds or pets with arthritis. Stairs requires a slight jumping motion which can put stress on sensitive spines. If your pet has mobility issues, a ramp is generally the safer long-term option."
    },
    {
        category: "products",
        question: "Are the ergonomic bowls dishwasher safe?",
        answer: "Yes! All of our ceramic and stainless steel bowl inserts are 100% dishwasher safe (top rack recommended). For stands made of bamboo or elevated wood, we recommend wiping them down with a damp cloth to preserve the finish."
    },
    {
        category: "shipping",
        question: "How long will my order take to arrive?",
        answer: "We typically process orders within 1-3 business days. Shipping within the contiguous United States generally takes 3-8 business days. Once shipped, you'll receive a tracking number via email."
    },
    {
        category: "shipping",
        question: "How much does shipping cost?",
        answer: "We offer flat-rate shipping of $5.99 for all orders within the contiguous US. Plus, we provide FREE standard shipping on all orders over $49.99!"
    },
    {
        category: "shipping",
        question: "Do you ship internationally?",
        answer: "Currently, PetPosture only ships to addresses within the contiguous 48 United States. We are actively working on expanding our shipping services to Alaska, Hawaii, and international destinations in the near future."
    },
    {
        category: "orders",
        question: "How do I start a return? (30-Day Guarantee)",
        answer: "We stand behind our 'Perfect Posture Guarantee.' If you're not satisfied within 30 days of delivery, simply email support@petposture.com with your order number. Our team will provide you with a Return Merchandise Authorization (RMA) and instructions."
    },
    {
        category: "orders",
        question: "My item arrived damaged. What do I do?",
        answer: "If your item arrives with any defects or shipping damage, please let us know within 7 days of delivery. Send photos to support@petposture.com and we will ship out a replacement immediately at no extra cost to you."
    },
    {
        category: "orders",
        question: "Can I change or cancel my order?",
        answer: "As long as your order hasn't been processed by our warehouse, we can make changes or cancellations. Please reach out to our support team as soon as possible via email or phone."
    }
];

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
            <section className="bg-[#f4f5f6] py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div initial="initial" animate="animate" variants={fadeUp}>
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-[#3e4c57] mb-6">
                            Frequently Asked Questions
                        </h1>
                        <p className="text-[#666666] text-[16px] max-w-2xl mx-auto leading-relaxed">
                            Find answers to common questions about our ergonomic pet products, shipping, and return policies.
                        </p>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mt-8"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-12 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Sidebar TOC */}
                    <aside className="hidden lg:block w-72 sticky top-36 h-fit">
                        <h4 className="text-[14px] font-bold uppercase tracking-widest text-[#3e4c57] mb-8 opacity-40">
                            Jump to Category
                        </h4>
                        <nav className="flex flex-col gap-5">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => scrollTo(cat.id)}
                                    className={`text-left text-[14px] font-bold uppercase tracking-wider transition-all hover:text-[#df8448] ${activeCategory === cat.id ? 'text-[#df8448] pl-3 border-l-2 border-[#df8448]' : 'text-[#3e4c57]/60 pl-3 border-l-2 border-transparent'
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
                                <h2 className="text-[22px] font-medium text-[#3e4c57] uppercase tracking-[0.15em] mb-8 border-b border-zinc-100 pb-3">
                                    {cat.title}
                                </h2>
                                <div className="space-y-0">
                                    {FAQ_ITEMS.filter(item => item.category === cat.id).map((item, idx) => {
                                        const globalIdx = FAQ_ITEMS.indexOf(item);
                                        const isOpen = openItems.includes(globalIdx);
                                        return (
                                            <div key={globalIdx} className="border-b border-zinc-50 last:border-none">
                                                <button
                                                    onClick={() => toggleItem(globalIdx)}
                                                    className="w-full flex items-center justify-between py-4 text-left group transition-all"
                                                >
                                                    <span className={`text-[17px] font-semibold transition-colors ${isOpen ? 'text-[#df8448]' : 'text-[#3e4c57] group-hover:text-[#df8448]'
                                                        }`}>
                                                        {item.question}
                                                    </span>
                                                    <ChevronDown
                                                        size={20}
                                                        className={`text-zinc-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#df8448]' : ''}`}
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
                                <MessageSquare className="text-[#df8448]" size={28} />
                            </div>
                            <h3 className="text-[22px] font-bold text-[#3e4c57] mb-4 uppercase tracking-widest">Still have questions?</h3>
                            <p className="text-[#666666] mb-8 max-w-md mx-auto text-[15px]">
                                Our friendly support team is here to help. We'll get back to you within 24 business hours.
                            </p>
                            <a
                                href="/contact"
                                className="inline-block bg-[#df8448] text-white px-10 py-4 rounded-[3px] border-2 border-[#df8448] font-bold uppercase tracking-[0.15em] text-[12px] hover:bg-[#c9713a] hover:border-[#c9713a] transition-all"
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
