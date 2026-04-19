"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, ShieldCheck, Footprints } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Header from "./Header";
import Footer from "./Footer";

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS (Synced with HomePage.tsx & Figma)
  ───────────────────────────────────────────────────────────────── */
const C = {
    primary: '#3e4c57', // Slate Blue-Gray (Main Heading & Buttons)
    primaryHover: '#2c3840',
    secondary: '#df8448', // Brand Orange (Eyebrows & Accents)
    secondaryHover: '#c9713a',
    white: '#ffffff',
    grayLight: '#f4f5f6',
    grayText: '#6b7280',
    border: '#e2e5e8',
};

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: "easeOut" }
};

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.2
        }
    }
};

export default function OurMissionPage() {
    const [activeSlide, setActiveSlide] = useState(0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const index = Math.round(el.scrollLeft / (el.clientWidth * 0.85));
        if (index !== activeSlide) setActiveSlide(index);
    };

    const features = [
        {
            icon: Compass,
            title: "Ergonomic-First Design",
            desc: "Every product in our store is chosen because it solves a specific anatomical or postural challenge."
        },
        {
            icon: ShieldCheck,
            title: "Health & Safety Focus",
            desc: "We consult with pet health professionals to ensure our solutions are safe, effective, and truly beneficial."
        },
        {
            icon: Footprints,
            title: "A Community of Care",
            desc: "We are more than a store. We are a resource for pet owners dedicated to giving their companions the best quality of life."
        }
    ];

    return (
        <div className="bg-white font-hanken overflow-hidden">
            <Header />

            {/* 1. Hero Section - Pixel Perfect Figma Layout */}
            <section className="relative py-16 px-4 md:px-8 bg-white">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        variants={fadeUp}
                        className="flex flex-col items-center"
                    >
                        {/* Eyebrow */}
                        <h1 className="text-[32px] md:text-[48px] font-bold uppercase tracking-[0.1em] text-[#3e4c57] mb-6 leading-tight">
                            Our Mission
                        </h1>
                        {/* Divider Line */}
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>

                        {/* Hero Subtitle */}
                        <p className="text-[18px] md:text-[22px] text-[#666666] max-w-2xl italic font-medium leading-relaxed">
                            Because &quot;one-size-fits-all&quot; doesn&apos;t work for pets.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* 2. The Standard Section - Infographic Narrative */}
            <section className="py-6 md:py-12 px-4 bg-[#f8f9fa] border-t border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        variants={fadeUp}
                    >
                        <h2 className="text-[24px] md:text-[36px] font-bold text-[#1A2B3C] uppercase tracking-[0.15em] leading-tight mb-4">
                            The &quot;Standard&quot; Isn&apos;t Good Enough
                        </h2>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center text-left">
                        {/* Infographic Logic */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative aspect-square md:aspect-[4/4] rounded-xl overflow-hidden shadow-2xl shadow-[#3e4c57]/10 bg-white"
                        >
                            <Image
                                src="assets/badposture-goodposture.jpg"
                                alt="Standard vs PetPosture"
                                fill
                                className="object-contain p-4"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] text-[#df8448] mb-6">Our Origin Story</h3>
                            <h4 className="text-[24px] font-bold text-[#3e4c57] tracking-[0.1em] leading-tight mb-8">WHY WE STARTED PETPOSTURE</h4>
                            <p className="text-[15px] md:text-[17px] text-[#333333] leading-relaxed mb-6 font-medium">
                                We saw pets struggling with products not built for them. We saw flat-faced breeds like Pugs and Frenchies straining their necks and struggling to breathe at mealtimes.
                            </p>
                            <p className="text-[15px] md:text-[17px] text-[#333333] leading-relaxed mb-8 font-medium">
                                We saw long-backed breeds like Dachshunds and Corgis risking serious spinal injury every time they jumped off the couch. <strong>We knew there had to be a better way to support their unique posture.</strong>
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 3. Our Core Mission - Figma Centered Layout */}
            <section className="py-6 md:py-12 px-4 bg-white text-center">
                <div className="max-w-[900px] mx-auto">
                    <motion.div
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        variants={fadeUp}
                    >
                        <h2 className="text-[24px] md:text-[36px] font-bold uppercase tracking-[0.15em] text-[#1A2B3C] mb-4">
                            Our Core Mission
                        </h2>
                        <div className="w-10 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>

                        <blockquote className="text-[18px] md:text-[22px] text-[#333333] leading-[1.6] font-medium italic max-w-3xl mx-auto mb-2">
                            &quot;Our mission is to improve the health and daily comfort of every pet by providing
                            expertly designed, breed-specific ergonomic solutions. We believe that better posture
                            leads to a longer, happier life.&quot;
                        </blockquote>
                    </motion.div>
                </div>
            </section>

            {/* 4. How We Make a Difference - Custom Icon Style + Slider on Mobile */}
            <section className="py-8 md:py-12 px-4 bg-[#f4f5f6]">
                <div className="max-w-[1200px] mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-[24px] md:text-[36px] font-bold text-[#1A2B3C] uppercase tracking-[0.15em] mb-4">
                            How We Make A Difference
                        </h2>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                    </div>

                    <div
                        className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 gap-0 md:gap-12 lg:gap-20"
                        onScroll={handleScroll}
                        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                    >
                        {features.map((feature, i) => (
                            <motion.div
                                key={i}
                                variants={fadeUp}
                                initial="initial"
                                whileInView="animate"
                                viewport={{ once: true }}
                                className="min-w-[85vw] md:min-w-0 snap-center flex flex-col items-center text-center group px-4 md:px-0"
                            >
                                <div className="w-16 h-16 bg-[#3e4c57] rounded-full flex items-center justify-center text-[#df8448] mb-8 group-hover:scale-110 transition-transform duration-500 shadow-xl shadow-black/10">
                                    <feature.icon size={36} strokeWidth={1} />
                                </div>
                                <h5 className="text-[18px] md:text-[22px] font-bold text-[#3e4c57] mb-4 uppercase tracking-wider">{feature.title}</h5>
                                <p className="text-[#333333] leading-relaxed text-[15px] md:text-[17px] font-medium">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Mobile Pagination Dots */}
                    <div className="flex md:hidden justify-center gap-2 mt-8">
                        {features.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-6 bg-[#df8448]' : 'w-2 bg-[#d1d5db]'}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* 5. Join Us CTA Section - Enhanced with Image Overlay & Depth */}
            <section className="py-6 md:py-10 px-4 bg-[#3e4c57] text-white text-center relative overflow-hidden group">
                {/* Visual Depth: Background Image Overlay */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80"
                        alt="Join background"
                        fill
                        className="object-cover opacity-10 group-hover:scale-110 transition-transform duration-[10s] ease-linear"
                    />
                    {/* Radial Glow */}
                    <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#3e4c57]/50 to-[#3e4c57]"></div>
                </div>

                <div className="absolute top-0 left-0 w-full h-1 bg-[#df8448]"></div>

                <div className="max-w-[1200px] mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1 }}
                    >
                        <h2 className="text-[16px] md:text-[20px] font-bold uppercase tracking-[0.3em] text-white/90 mb-6">
                            Join Us In Our Mission
                        </h2>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>

                        <p className="text-[15px] md:text-[18px] text-zinc-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                            Help your pet live their most comfortable, healthy, and happy life.
                        </p>

                        <Link
                            href="/shop"
                            className="inline-block px-10 py-3 border-2 border-[#df8448] text-[#df8448] font-bold uppercase tracking-[.2em] text-[15px] hover:bg-[#df8448] hover:text-white transition-all duration-500 rounded relative group overflow-hidden"
                        >
                            <span className="relative z-10">Shop Our Solutions</span>
                            <div className="absolute inset-0 bg-[#df8448] translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                        </Link>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
