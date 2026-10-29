"use client";

import React from 'react';
import { ShieldCheck, Truck, RotateCcw, Award } from 'lucide-react';

export function TrustBadgeBar() {
    const badges = [
        { icon: <Truck size={20} />, label: "FREE SHIPPING $50+", sub: "Standard, contiguous US" },
        { icon: <Award size={20} />, label: "CAREFULLY SELECTED", sub: "Practical research first" },
        { icon: <ShieldCheck size={20} />, label: "DAMAGE PROTECTION", sub: "Report within 7 days" },
        { icon: <RotateCcw size={20} />, label: "30-DAY RETURNS", sub: "Unused items, see policy" }
    ];

    return (
        <section className="border-y border-zinc-100 py-12 px-4 md:px-8">
            <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
                {badges.map((badge, index) => (
                    <div key={index} className="flex flex-col items-center gap-3 text-center group">
                        <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-ink transition-all duration-500">
                            {badge.icon}
                        </div>
                        <div>
                            <p className="text-xs font-black text-primary uppercase tracking-wider mb-1">{badge.label}</p>
                            <p className="text-zinc-400 text-xs font-medium tracking-wide uppercase">{badge.sub}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
