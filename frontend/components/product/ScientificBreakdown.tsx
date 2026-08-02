"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/types/shop';
import { Activity, Beaker, Heart, Shield } from 'lucide-react';

interface ScientificBreakdownProps {
    product: Product;
}

export function ScientificBreakdown({ product }: ScientificBreakdownProps) {
    void product;
    const [activeSlide, setActiveSlide] = useState(0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const index = Math.round(el.scrollLeft / (el.clientWidth * 0.78));
        if (index !== activeSlide) setActiveSlide(index);
    };

    const specs = [
        { icon: <Beaker size={24} />, title: "BIOMETRIC FIT", desc: "Digital mapping ensures zero pressure points on joints." },
        { icon: <Activity size={24} />, title: "VET-VALIDATED", desc: "Clinically tested to improve spinal alignment by 22%." },
        { icon: <Heart size={24} />, title: "RECOVERY CORE", desc: "Materials chosen for optimal heat regulation and bloodflow." },
        { icon: <Shield size={24} />, title: "DURA-HYGIENE", desc: "Anti-microbial surfaces for long-term respiratory safety." }
    ];

    return (
        <section className="bg-[#3e4c57] py-24 px-4 md:px-8 relative overflow-hidden">
            <div className="max-w-[1200px] mx-auto relative z-10">
                <div className="text-center mb-16 px-4">
                    <h2 className="text-[#df8448] text-xs font-black uppercase tracking-[0.18em] mb-4">Ergo-Care Science</h2>
                    <h3 className="text-white text-[32px] md:text-[44px] font-bold leading-tight">THE BIOLOGY OF COMFORT</h3>
                    <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mt-6"></div>
                </div>

                <div
                    className="scrollbar-hide flex snap-x snap-mandatory flex-row gap-4 overflow-x-auto px-4 md:grid md:grid-cols-2 md:gap-12 md:overflow-visible md:px-0 lg:grid-cols-4"
                    onScroll={handleScroll}
                >
                    {specs.map((spec, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group flex w-[78%] flex-shrink-0 snap-center flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center md:w-auto md:flex-shrink md:border-none md:bg-transparent md:px-0 md:py-0"
                        >
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-[#df8448] mb-6 border border-white/10 group-hover:bg-[#df8448] group-hover:text-white transition-all duration-500">
                                {spec.icon}
                            </div>
                            <h4 className="text-white text-[14px] font-bold uppercase tracking-widest mb-3">{spec.title}</h4>
                            <p className="text-white/40 text-[14px] leading-relaxed px-4">{spec.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-10 flex justify-center gap-2 md:hidden">
                    {specs.map((_, idx) => (
                        <div
                            key={idx}
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                                width: activeSlide === idx ? 24 : 8,
                                background: activeSlide === idx ? '#df8448' : 'rgba(255,255,255,0.2)',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Background Bio-Graphic */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full pointer-events-none opacity-20 scale-150"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full pointer-events-none opacity-20 scale-150"></div>
        </section>
    );
}
