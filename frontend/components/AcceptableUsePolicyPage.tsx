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
    { id: "who-we-are", title: "1. WHO WE ARE" },
    { id: "use-of-services", title: "2. USE OF THE SERVICES" },
    { id: "contributions", title: "3. CONTRIBUTIONS" },
    { id: "review-ratings", title: "4. REVIEW AND RATINGS" },
    { id: "reporting", title: "5. REPORTING A BREACH" },
    { id: "consequences", title: "6. CONSEQUENCES OF BREACHING" },
    { id: "contact", title: "7. CONTACT US" },
];

export default function AcceptableUsePolicyPage() {
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
                            Acceptable Use Policy
                        </h1>
                        <p className="text-[#666666] text-[16px] font-medium">
                            Last updated: November 10, 2025
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
                            <div className="space-y-20">
                                <section id="who-we-are">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">1. WHO WE ARE</h2>
                                    <p>
                                        PetPosture LLC (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;) is a company registered in the United States at 2017 I STA, Sacramento, CA 95811. We operate the website http://petposture.com (the &quot;<strong>Site</strong>&quot;), and any other related products and services that refer or link to this Acceptable Use Policy (collectively, the &quot;<strong>Services</strong>&quot;).
                                    </p>
                                </section>

                                <section id="use-of-services">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">2. USE OF THE SERVICES</h2>
                                    <p>When you use the Services, you agree to abide by this Acceptable Use Policy and our Terms and Conditions. You may not use the Services:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li>In any way that breaches any applicable local, national, or international law or regulation.</li>
                                        <li>In any way that is unlawful or fraudulent, or has any unlawful or fraudulent purpose or effect.</li>
                                        <li>For the purpose of harming or attempting to harm minors in any way.</li>
                                        <li>To send, knowingly receive, upload, download, use, or re-use any material which does not comply with our content standards.</li>
                                        <li>To transmit, or procure the sending of, any unsolicited or unauthorized advertising or promotional material or any other form of similar solicitation (spam).</li>
                                        <li>To knowingly transmit any data, send or upload any material that contains viruses, Trojan horses, worms, time-bombs, keystroke loggers, spyware, adware, or any other harmful programs.</li>
                                    </ul>
                                </section>

                                <section id="contributions">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">3. CONTRIBUTIONS</h2>
                                    <p>Any content you upload to our Services will be considered non-confidential and non-proprietary. You must ensure that your contributions:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li>Are accurate (where they state facts).</li>
                                        <li>Are genuinely held (where they state opinions).</li>
                                        <li>Comply with applicable law in the United States and in any country from which they are posted.</li>
                                    </ul>
                                </section>

                                <section id="review-ratings">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">4. REVIEW AND RATINGS</h2>
                                    <p>When posting a review or rating, you must ensure that:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li>You have firsthand experience with the person/entity being reviewed.</li>
                                        <li>Your review does not contain offensive profanity, or abusive, racist, offensive, or hate language.</li>
                                        <li>Your review does not contain discriminatory references based on religion, race, gender, national origin, age, marital status, sexual orientation, or disability.</li>
                                    </ul>
                                </section>

                                <section id="reporting">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">5. REPORTING A BREACH OF THIS POLICY</h2>
                                    <p>If you wish to report a breach of this Policy, please contact us at <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a>. We will review the report and take appropriate action in accordance with this Policy.</p>
                                </section>

                                <section id="consequences">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">6. CONSEQUENCES OF BREACHING THIS POLICY</h2>
                                    <p>Failure to comply with this Acceptable Use Policy constitutes a material breach of the Terms and Conditions upon which you are permitted to use the Services, and may result in our taking all or any of the following actions:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li>Immediate, temporary, or permanent withdrawal of your right to use the Services.</li>
                                        <li>Immediate, temporary, or permanent removal of any Contribution uploaded by you to the Services.</li>
                                        <li>Issuance of a warning to you.</li>
                                        <li>Legal proceedings against you for reimbursement of all costs on an indemnity basis (including, but not limited to, reasonable administrative and legal costs) resulting from the breach.</li>
                                    </ul>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">7. HOW CAN YOU CONTACT US ABOUT THIS POLICY?</h2>
                                    <p>If you have any further questions or comments, you may contact us at:</p>
                                    <p className="mt-4 font-bold">PetPosture LLC</p>
                                    <p>2017 I STA</p>
                                    <p>Sacramento, CA 95811</p>
                                    <p>United States</p>
                                    <p className="mt-4">Email: <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a></p>
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
