"use client";

import React from 'react';
import { ShieldCheck, Truck, RotateCcw, Award } from 'lucide-react';

export function TrustBadgeBar() {
    const badges = [
        { icon: <Truck size={20} />, label: "USA NEXT-DAY SHIPPING", sub: "Orders over $50" },
        { icon: <Award size={20} />, label: "CERTIFIED ERGONOMIC", sub: "BVet Approved" },
        { icon: <ShieldCheck size={20} />, label: "LIFETIME REPLACEMENT", sub: "On all hardware" },
        { icon: <RotateCcw size={20} />, label: "30-DAY RISK FREE", sub: "Health trial" }
    ];

    return (
        <section className="border-y border-zinc-100 py-12 px-4 md:px-8">
            <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
                {badges.map((badge, index) => (
                    <div key={index} className="flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center text-[#3e4c57] group-hover:bg-[#df8448] group-hover:text-white transition-all duration-500">
                            {badge.icon}
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-[#3e4c57] uppercase tracking-wider mb-1">{badge.label}</p>
                            <p className="text-zinc-400 text-[10px] font-medium tracking-wide uppercase">{badge.sub}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
