"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const SECTIONS = [
    { id: "disclosure", title: "1. AFFILIATE DISCLOSURE" },
    { id: "how-it-works", title: "2. HOW AFFILIATE LINKS WORK" },
    { id: "our-commitment", title: "3. OUR EDITORIAL COMMITMENT" },
    { id: "ftc", title: "4. FTC COMPLIANCE" },
    { id: "contact", title: "5. CONTACT US" },
];

export default function AffiliateDisclosurePage() {
    const [activeSection, setActiveSection] = useState("");

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
            <section className="bg-[#f4f5f6] py-20 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeUp}
                    >
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-[#3e4c57] mb-4">
                            Affiliate Disclosure
                        </h1>
                        <p className="text-[#666666] text-[16px] font-medium">
                            Last updated: August 8, 2026
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
                                    className={`text-left text-sm font-bold uppercase tracking-wider transition-all hover:text-[#df8448] ${activeSection === s.id ? 'text-[#df8448] pl-2 border-l-2 border-[#df8448]' : 'text-[#666666]'
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
                            <p className="mb-12">
                                PetPosture LLC (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;) participates in affiliate marketing programs, which means some links and product recommendations on our website and blog may be affiliate links.
                            </p>

                            <div className="space-y-20">
                                <section id="disclosure">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">1. AFFILIATE DISCLOSURE</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> Some links on our Site are affiliate links. If you make a purchase through one, we may earn a commission at no extra cost to you.</p>
                                    <p>Certain articles, product comparisons, and buying guides on our Site contain links to third-party retailers and marketplaces (such as Amazon, Chewy, Petco, PetSmart, and Walmart). Some of these are affiliate links, meaning that if you click through and make a purchase, PetPosture LLC may receive a small commission from the retailer. This comes at no additional cost to you — the price you pay is the same whether or not you use our link.</p>
                                </section>

                                <section id="how-it-works">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">2. HOW AFFILIATE LINKS WORK</h2>
                                    <p>When you click an affiliate link on our Site, a cookie or tracking parameter provided by the retailer or its affiliate network may be placed in your browser so that, if you complete a purchase, the retailer can attribute the resulting commission to us. We do not control, and are not responsible for, the privacy practices of these third-party retailers or affiliate networks. Please review their respective privacy policies before making a purchase.</p>
                                </section>

                                <section id="our-commitment">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">3. OUR EDITORIAL COMMITMENT</h2>
                                    <p>Whether or not a link is an affiliate link has no bearing on our editorial opinions. We recommend products based on genuine research and, where possible, real-world use, not on which link pays the highest commission. Affiliate relationships do not influence the content of our reviews, comparisons, or recommendations.</p>
                                </section>

                                <section id="ftc">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">4. FTC COMPLIANCE</h2>
                                    <p>This disclosure is provided in accordance with the Federal Trade Commission&apos;s 16 CFR Part 255, &quot;Guides Concerning the Use of Endorsements and Testimonials in Advertising.&quot; Wherever an individual post contains affiliate links, we also include an in-context notice directly on that page.</p>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">5. HOW CAN YOU CONTACT US ABOUT THIS DISCLOSURE?</h2>
                                    <p>If you have questions about our affiliate relationships, you may email us at <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a> or by post to:</p>
                                    <p className="mt-4 font-bold">PetPosture LLC</p>
                                    <p>2017 I St A</p>
                                    <p>Sacramento, CA 95811</p>
                                    <p>United States</p>
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
