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
    { id: "info-collect", title: "1. WHAT INFORMATION DO WE COLLECT?" },
    { id: "info-process", title: "2. HOW DO WE PROCESS YOUR INFORMATION?" },
    { id: "share-info", title: "3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?" },
    { id: "cookies", title: "4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?" },
    { id: "social-logins", title: "5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?" },
    { id: "international", title: "6. IS YOUR INFORMATION TRANSFERRED INTERNATIONALLY?" },
    { id: "retention", title: "7. HOW LONG DO WE KEEP YOUR INFORMATION?" },
    { id: "minors", title: "8. DO WE COLLECT INFORMATION FROM MINORS?" },
    { id: "rights", title: "9. WHAT ARE YOUR PRIVACY RIGHTS?" },
    { id: "dnt", title: "10. CONTROLS FOR DO-NOT-TRACK FEATURES" },
    { id: "updates", title: "11. DO WE MAKE UPDATES TO THIS NOTICE?" },
    { id: "contact", title: "12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?" },
    { id: "review", title: "13. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?" },
];

export default function PrivacyPolicyPage() {
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
                            Privacy Policy
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
                            <p className="mb-8">
                                This privacy notice for PetPosture LLC (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;), describes how and why we might collect, store, use, and/or share (&quot;<strong>process</strong>&quot;) your information when you use our services (&quot;<strong>Services</strong>&quot;), such as when you:
                            </p>
                            <ul className="list-disc pl-6 mb-8 space-y-2">
                                <li>Visit our website at <a href="http://petposture.com" className="text-[#df8448] hover:underline">http://petposture.com</a>, or any website of ours that links to this privacy notice</li>
                                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
                            </ul>
                            <p className="mb-12">
                                <strong>Questions or concerns?</strong> Reading this privacy notice will help you understand your privacy rights and choices. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a>.
                            </p>

                            {/* Summary of Key Points */}
                            <div className="bg-[#f8fafc] border border-zinc-100 rounded-2xl p-8 mb-16 shadow-sm">
                                <h2 className="text-[24px] font-bold text-[#3e4c57] mb-6 uppercase tracking-tight">SUMMARY OF KEY POINTS</h2>
                                <p className="italic mb-6">This summary provides key points from our privacy notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</p>
                                <div className="space-y-6">
                                    <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with PetPosture LLC and the Services, the choices you make, and the products and features you use.</p>
                                    <p><strong>Do we process any sensitive personal information?</strong> We do not process sensitive personal information.</p>
                                    <p><strong>Do we receive any information from third parties?</strong> We do not receive any information from third parties.</p>
                                    <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
                                    <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties.</p>
                                </div>
                            </div>

                            {/* Detailed Sections */}
                            <div className="space-y-20">
                                <section id="info-collect">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">1. WHAT INFORMATION DO WE COLLECT?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We collect personal information that you provide to us.</p>
                                    <p className="mb-4">We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</p>
                                    <h3 className="text-[20px] font-bold text-[#3e4c57] mt-8 mb-4">Personal Information Provided by You</h3>
                                    <p className="mb-4">The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
                                    <ul className="list-disc pl-6 space-y-2">
                                        <li>names</li>
                                        <li>phone numbers</li>
                                        <li>email addresses</li>
                                        <li>mailing addresses</li>
                                        <li>job titles</li>
                                        <li>billing addresses</li>
                                        <li>debit/credit card numbers</li>
                                    </ul>
                                </section>

                                <section id="info-process">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
                                    <p className="mb-4">We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
                                    <ul className="list-disc pl-6 space-y-2">
                                        <li>To facilitate account creation and authentication and otherwise manage user accounts.</li>
                                        <li>To deliver and facilitate delivery of services to the user.</li>
                                        <li>To respond to user inquiries/offer support to users.</li>
                                        <li>To send administrative information to you.</li>
                                        <li>To fulfill and manage your orders.</li>
                                        <li>To enable user-to-user communications.</li>
                                        <li>To request feedback.</li>
                                        <li>To send you marketing and promotional communications.</li>
                                        <li>To protect our Services.</li>
                                    </ul>
                                </section>

                                <section id="share-info">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We may share information in specific situations described in this section and/or with the following third parties.</p>
                                    <p className="mb-4">We may need to share your personal information in the following situations:</p>
                                    <ul className="list-disc pl-6 space-y-2">
                                        <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                                        <li><strong>Affiliates.</strong> We may share your information with our affiliates, in which case we will require those affiliates to honor this privacy notice.</li>
                                    </ul>
                                </section>

                                <section id="cookies">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We may use cookies and other tracking technologies to collect and store your information.</p>
                                    <p>We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.</p>
                                </section>

                                <section id="social-logins">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</p>
                                    <p>Our Services offer you the ability to register and log in using your third-party social media account details (like your Facebook or Twitter logins). Where you choose to do this, we will receive certain profile information about you from your social media provider.</p>
                                </section>

                                <section id="international">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">6. IS YOUR INFORMATION TRANSFERRED INTERNATIONALLY?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We may transfer, store, and process your information in countries other than your own.</p>
                                    <p>Our servers are located in the United States. If you are accessing our Services from outside the United States, please be aware that your information may be transferred to, stored, and processed by us in our facilities and by those third parties with whom we may share your personal information.</p>
                                </section>

                                <section id="retention">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">7. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We keep your information for as long as necessary to fulfill the purposes outlined in this privacy notice unless otherwise required by law.</p>
                                    <p>We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements).</p>
                                </section>

                                <section id="minors">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">8. DO WE COLLECT INFORMATION FROM MINORS?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</p>
                                    <p>We do not knowingly solicit data from or market to children under 18 years of age. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent&apos;s use of the Services.</p>
                                </section>

                                <section id="rights">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">9. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> You may review, change, or terminate your account at any time.</p>
                                    <p>If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your local data protection supervisory authority.</p>
                                </section>

                                <section id="dnt">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">10. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
                                    <p>Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (&quot;DNT&quot;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected.</p>
                                </section>

                                <section id="updates">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">11. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
                                    <p className="italic mb-6"><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
                                    <p>We may update this privacy notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date and the updated version will be effective as soon as it is accessible.</p>
                                </section>

                                <section id="contact">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
                                    <p>If you have questions or comments about this notice, you may email us at <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a> or by post to:</p>
                                    <p className="mt-4 font-bold">PetPosture LLC</p>
                                    <p>123 Pet Lane, Suite 100</p>
                                    <p>San Francisco, CA 94107</p>
                                    <p>United States</p>
                                </section>

                                <section id="review">
                                    <h2 className="text-[28px] font-bold text-[#3e4c57] uppercase tracking-tight mb-6">13. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
                                    <p>Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, change that information, or delete it. To request to review, update, or delete your personal information, please visit: <a href="mailto:support@petposture.com" className="text-[#df8448] hover:underline">support@petposture.com</a>.</p>
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
