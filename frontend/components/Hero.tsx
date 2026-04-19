"use client";

import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-white" style={{ minHeight: "400px", maxHeight: "680px" }}>
      {/* Background Image Layer */}
      <div className="absolute inset-0">
        <Image
          src="/assets/banner-5.jpg"
          alt="Ergonomic feeding stance"
          fill
          className="object-cover object-[center_65%]"
          priority
          sizes="100vw"
        />
        {/* Subtle overlay for text readability, gradient on desktop */}
        <div className="absolute inset-0 bg-black/10 lg:bg-gradient-to-r lg:from-black/60 lg:via-black/20 lg:to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex items-start lg:items-center h-full min-h-[400px] pt-12 pb-8 lg:py-12">
        <div className="max-w-[1200px] w-full mx-auto px-6 flex justify-center lg:justify-start">
          <div className="max-w-fit flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Obsidian Glass Box */}
            <div className="bg-black/20 backdrop-blur-[4px] border border-white/20 rounded-2xl p-6 lg:px-10 lg:py-8 shadow-2xl">
              <h1 className="text-white text-[24px] md:text-[30px] font-black uppercase tracking-[0.1em] leading-[1.3] mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" style={{ fontFamily: 'var(--font-hanken)' }}>
                Support Their Stance.<br />
                Improve Their Life.
              </h1>

              <p className="text-white text-[14px] md:text-[15px] mb-6 max-w-[420px] leading-relaxed tracking-[0.02em] mx-auto lg:mx-0 drop-shadow-sm">
                Ergonomic essentials designed for your pet&apos;s unique posture and health needs.
              </p>

              <div className="flex flex-row w-full justify-center lg:justify-start gap-2 md:gap-4">
                <Link
                  href="/shop-by-breed"
                  className="flex-1 bg-[#df8448] hover:bg-[#c9713a] text-white px-3 lg:px-7 py-3.5 font-bold text-[11px] md:text-[13px] uppercase tracking-[0.05em] lg:tracking-[0.12em] transition-colors rounded-sm shadow-md text-center"
                  style={{ fontFamily: 'var(--font-lato)', whiteSpace: 'nowrap' }}
                >
                  Find Your Breed
                </Link>
                <Link
                  href="/shop-by-solution"
                  className="flex-1 bg-white hover:bg-gray-100 text-[#3e4c57] px-3 lg:px-7 py-3.5 font-bold text-[11px] md:text-[13px] uppercase tracking-[0.05em] lg:tracking-[0.12em] transition-colors rounded-sm shadow-md text-center"
                  style={{ fontFamily: 'var(--font-lato)', whiteSpace: 'nowrap' }}
                >
                  Shop Solutions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}