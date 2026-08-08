"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CookieConsentModal } from '@/components/CookieConsentModal';
import { getConsent, saveConsent } from '@/lib/cookieConsent';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const SECTIONS = [
    { id: "what-are", title: "1. WHAT ARE COOKIES?" },
    { id: "why-use", title: "2. WHY DO WE USE COOKIES?" },
    { id: "control-manager", title: "3. HOW CAN I CONTROL COOKIES?" },
    { id: "control-browser", title: "4. HOW CAN I CONTROL COOKIES ON MY BROWSER?" },
    { id: "beacons", title: "5. OTHER TRACKING TECHNOLOGIES" },
    { id: "flash", title: "6. FLASH COOKIES OR LSOS" },
    { id: "advertising", title: "7. TARGETED ADVERTISING" },
    { id: "updates", title: "8. UPDATES TO THIS POLICY" },
    { id: "contact", title: "9. FURTHER INFORMATION" },
];

export default function CookiePolicyPage() {
    const [activeSection, setActiveSection] = useState("");
    const [preferencesOpen, setPreferencesOpen] = useState(false);

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
            <section className="bg-gray-50 py-20 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeUp}
                    >
                        <h1 className="text-[32px] md:text-[42px] font-bold uppercase tracking-[0.1em] text-primary mb-4">
                            Cookie Policy
                        </h1>
                        <p className="text-[#666666] text-[16px] font-medium">
                            Last updated: November 10, 2025
                        </p>
                        <div className="w-12 h-1 bg-secondary mx-auto rounded-full mt-6"></div>
                    </motion.div>
                </div>
            </section>

            <section className="py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Sidebar Table of Contents (Desktop) */}
                    <aside className="hidden lg:block w-80 sticky top-32 h-fit">
                        <h4 className="text-[14px] font-bold uppercase tracking-widest text-primary mb-8 border-b border-zinc-100 pb-4">
                            Table of Contents
                        </h4>
                        <nav className="flex flex-col gap-4">
                            {SECTIONS.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => scrollTo(s.id)}
                                    className={`text-left text-sm font-bold uppercase tracking-wider transition-all hover:text-secondary ${activeSection === s.id ? 'text-secondary pl-2 border-l-2 border-secondary' : 'text-[#666666]'
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
                                This Cookie Policy explains how PetPosture LLC (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; and &quot;<strong>our</strong>&quot;) uses cookies and similar technologies to recognize you when you visit our website at <a href="http://petposture.com" className="text-secondary hover:underline">http://petposture.com</a> (&quot;<strong>Website</strong>&quot;). It explains what these technologies are and why we use them, as well as your rights to control our use of them.
                            </p>
                            <p className="mb-12">
                                In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information.
                            </p>

                            <div className="space-y-20">
                                <section id="what-are">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">1. WHAT ARE COOKIES?</h2>
                                    <p>Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.</p>
                                    <p className="mt-4">Cookies set by the website owner (in this case, PetPosture LLC) are called &quot;first-party cookies.&quot; Cookies set by parties other than the website owner are called &quot;third-party cookies.&quot;</p>
                                </section>

                                <section id="why-use">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">2. WHY DO WE USE COOKIES?</h2>
                                    <p>We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as &quot;essential&quot; or &quot;strictly necessary&quot; cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our Online Sections. Third parties serve cookies through our Website for advertising, analytics, and other purposes.</p>
                                </section>

                                <section id="control-manager">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">3. HOW CAN I CONTROL COOKIES?</h2>
                                    <p>You have the right to decide whether to accept or reject cookies. When you first visit our Website, a cookie banner lets you choose <strong>Accept All</strong> or <strong>Customize</strong> your preferences by category:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li><strong>Essential cookies</strong> (always on) — required to keep your cart and account signed in. These cannot be disabled.</li>
                                        <li><strong>Analytics cookies</strong> (off by default) — used to understand site traffic via Google Analytics. These only load after you opt in.</li>
                                    </ul>
                                    <p className="mt-4">Your choice is saved in your browser and respected on future visits. If your browser sends a Global Privacy Control (GPC) signal, we automatically treat it as a request to opt out of non-essential cookies and will not show the banner.</p>
                                    <p className="mt-4">You can change your preferences at any time using the button below.</p>
                                    <button
                                        onClick={() => setPreferencesOpen(true)}
                                        className="mt-6 inline-flex items-center border border-secondary text-secondary text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-lg hover:bg-secondary hover:text-white transition-colors"
                                    >
                                        Manage Cookie Preferences
                                    </button>
                                </section>

                                <section id="control-browser">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">4. HOW CAN I CONTROL COOKIES ON MY BROWSER?</h2>
                                    <p>As the means by which you can refuse cookies through your web browser controls vary from browser to browser, you should visit your browser&apos;s help menu for more information. The following is information about how to manage cookies on the most popular browsers:</p>
                                    <ul className="list-disc pl-6 space-y-2 mt-4">
                                        <li>Chrome</li>
                                        <li>Internet Explorer</li>
                                        <li>Firefox</li>
                                        <li>Safari</li>
                                        <li>Edge</li>
                                        <li>Opera</li>
                                    </ul>
                                </section>

                                <section id="beacons">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">5. WHAT ABOUT OTHER TRACKING TECHNOLOGIES, LIKE WEB BEACONS?</h2>
                                    <p>Cookies are not the only way to recognize or track visitors to a website. We may use other, similar technologies from time to time, like web beacons (sometimes called &quot;tracking pixels&quot; or &quot;clear gifs&quot;). These are tiny graphics files that contain a unique identifier that enables us to recognize when someone has visited our Website or opened an email including them.</p>
                                </section>

                                <section id="flash">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">6. DO YOU USE FLASH COOKIES OR LOCAL SHARED OBJECTS?</h2>
                                    <p>Websites may also use so-called &quot;Flash Cookies&quot; (also known as Local Shared Objects or &quot;LSOs&quot;) to, among other things, collect and store information about your use of our services, fraud prevention, and for other site operations.</p>
                                </section>

                                <section id="advertising">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">7. DO YOU SERVE TARGETED ADVERTISING?</h2>
                                    <p>Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites in order to provide relevant advertisements about goods and services that you may be interested in.</p>
                                </section>

                                <section id="updates">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">8. HOW OFTEN WILL YOU UPDATE THIS COOKIE POLICY?</h2>
                                    <p>We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal, or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.</p>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[28px] font-bold text-primary uppercase tracking-tight mb-6">9. WHERE CAN I GET FURTHER INFORMATION?</h2>
                                    <p>If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:support@petposture.com" className="text-secondary hover:underline">support@petposture.com</a> or by post to:</p>
                                    <p className="mt-4 font-bold">PetPosture LLC</p>
                                    <p>2017 I St A</p>
                                    <p>Sacramento, CA 95811</p>
                                    <p>United States</p>
                                    <p>Phone: +1 (916) 623-5368</p>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <CookieConsentModal
                open={preferencesOpen}
                initialAnalytics={getConsent()?.analytics ?? false}
                onClose={() => setPreferencesOpen(false)}
                onSave={(analytics) => {
                    saveConsent({ analytics, method: "customize" });
                    setPreferencesOpen(false);
                }}
            />

            <Footer />
        </main>
    );
}
