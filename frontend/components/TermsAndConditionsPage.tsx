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
    { id: "services", title: "1. OUR SERVICES" },
    { id: "ip", title: "2. INTELLECTUAL PROPERTY RIGHTS" },
    { id: "representations", title: "3. USER REPRESENTATIONS" },
    { id: "prohibited", title: "4. PROHIBITED ACTIVITIES" },
    { id: "contributions", title: "5. USER-GENERATED CONTRIBUTIONS" },
    { id: "license", title: "6. CONTRIBUTION LICENSE" },
    { id: "management", title: "7. SERVICES MANAGEMENT" },
    { id: "termination", title: "8. TERM AND TERMINATION" },
    { id: "modifications", title: "9. MODIFICATIONS AND INTERRUPTIONS" },
    { id: "governing-law", title: "10. GOVERNING LAW" },
    { id: "dispute", title: "11. DISPUTE RESOLUTION" },
    { id: "corrections", title: "12. CORRECTIONS" },
    { id: "disclaimer", title: "13. DISCLAIMER" },
    { id: "liability", title: "14. LIMITATIONS OF LIABILITY" },
    { id: "indemnification", title: "15. INDEMNIFICATION" },
    { id: "user-data", title: "16. USER DATA" },
    { id: "electronics", title: "17. ELECTRONIC COMMUNICATIONS" },
    { id: "misc", title: "18. MISCELLANEOUS" },
    { id: "contact", title: "19. CONTACT US" },
];

export default function TermsAndConditionsPage() {
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
                            Terms and Conditions
                        </h1>
                        <p className="text-[#666666] text-[16px] font-medium">
                            Last updated: November 11, 2025
                        </p>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mt-6"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Sidebar Table of Contents (Desktop) */}
                    <aside className="hidden lg:block w-80 sticky top-32 h-fit max-h-[80vh] overflow-y-auto pr-4 custom-scrollbar">
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
                            <p className="mb-8">
                                These Terms and Conditions (&quot;<strong>Terms</strong>&quot;) constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&quot;<strong>you</strong>&quot;) and PetPosture LLC (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;), concerning your access to and use of the <a href="http://petposture.com" className="text-[#df8448] hover:underline">http://petposture.com</a> website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto (collectively, the &quot;<strong>Site</strong>&quot;).
                            </p>
                            <p className="mb-12">
                                You agree that by accessing the Site, you have read, understood, and agreed to be bound by all of these Terms and Conditions. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE TERMS AND CONDITIONS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SITE AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
                            </p>

                            <div className="space-y-20">
                                <section id="services">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">1. OUR SERVICES</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We provide ergonomic pet solutions and informative content regarding pet health and posture.</p>
                                    <p>The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country.</p>
                                </section>

                                <section id="ip">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">2. INTELLECTUAL PROPERTY RIGHTS</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We are the owner or the licensee of all intellectual property rights in our Services.</p>
                                    <p>Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the &quot;Content&quot;) and the trademarks, service marks, and logos contained therein (the &quot;Marks&quot;) are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.</p>
                                </section>

                                <section id="representations">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">3. USER REPRESENTATIONS</h2>
                                    <p>By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms and Conditions.</p>
                                </section>

                                <section id="prohibited">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">4. PROHIBITED ACTIVITIES</h2>
                                    <p>You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
                                </section>

                                <section id="contributions">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">5. USER-GENERATED CONTRIBUTIONS</h2>
                                    <p>The Site may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Site.</p>
                                </section>

                                <section id="license">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">6. CONTRIBUTION LICENSE</h2>
                                    <p>By posting your Contributions to any part of the Site, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to host, use, copy, reproduce, and disclose.</p>
                                </section>

                                <section id="management">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">7. SERVICES MANAGEMENT</h2>
                                    <p>We reserve the right, but not the obligation, to: (1) monitor the Site for violations of these Terms and Conditions; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Terms and Conditions.</p>
                                </section>

                                <section id="termination">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">8. TERM AND TERMINATION</h2>
                                    <p>These Terms and Conditions shall remain in full force and effect while you use the Site. WITHOUT LIMITING ANY OTHER PROVISION OF THESE TERMS AND CONDITIONS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SITE.</p>
                                </section>

                                <section id="modifications">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">9. MODIFICATIONS AND INTERRUPTIONS</h2>
                                    <p>We reserve the right to change, modify, or remove the contents of the Site at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Site.</p>
                                </section>

                                <section id="governing-law">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">10. GOVERNING LAW</h2>
                                    <p>These Terms and Conditions and your use of the Site are governed by and construed in accordance with the laws of the State of California applicable to agreements made and to be entirely performed within the State of California, without regard to its conflict of law principles.</p>
                                </section>

                                <section id="dispute">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">11. DISPUTE RESOLUTION</h2>
                                    <h3 className="text-[20px] font-bold text-[#3e4c57] mt-8 mb-4">Binding Arbitration</h3>
                                    <p>If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (except those Disputes expressly excluded below) will be finally and exclusively resolved by binding arbitration.</p>
                                </section>

                                <section id="corrections">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">12. CORRECTIONS</h2>
                                    <p>There may be information on the Site that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Site at any time, without prior notice.</p>
                                </section>

                                <section id="disclaimer">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">13. DISCLAIMER</h2>
                                    <p className="font-bold">THE SITE IS PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SITE AND OUR SERVICES WILL BE AT YOUR SOLE RISK.</p>
                                </section>

                                <section id="liability">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">14. LIMITATIONS OF LIABILITY</h2>
                                    <p>IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SITE.</p>
                                </section>

                                <section id="indemnification">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">15. INDEMNIFICATION</h2>
                                    <p>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys&apos; fees and expenses, made by any third party due to or arising out of: (1) use of the Site; (2) breach of these Terms and Conditions.</p>
                                </section>

                                <section id="user-data">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">16. USER DATA</h2>
                                    <p>We will maintain certain data that you transmit to the Site for the purpose of managing the performance of the Site, as well as data relating to your use of the Site. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Site.</p>
                                </section>

                                <section id="electronics">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">17. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h2>
                                    <p>Visiting the Site, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Site, satisfy any legal requirement that such communication be in writing.</p>
                                </section>

                                <section id="misc">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">18. MISCELLANEOUS</h2>
                                    <p>These Terms and Conditions and any policies or operating rules posted by us on the Site or in respect to the Site constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Terms and Conditions shall not operate as a waiver of such right or provision.</p>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">19. CONTACT US</h2>
                                    <p>In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at:</p>
                                    <p className="mt-4 font-bold">PetPosture LLC</p>
                                    <p>123 Pet Lane, Suite 100</p>
                                    <p>San Francisco, CA 94107</p>
                                    <p>United States</p>
                                    <p className="mt-4">
                                        Email: <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a>
                                    </p>
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
