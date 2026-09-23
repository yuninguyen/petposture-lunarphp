"use client";

import Image from "next/image";
import Link from "next/link";

const DEFAULT_HERO_IMAGE = "/assets/banner/hero-banner-homepage.webp";

export default function Hero({ heroImage }: { heroImage?: string | null }) {
  const resolvedHeroImage = heroImage || DEFAULT_HERO_IMAGE;

  return (
    <section className="relative min-h-[390px] w-full overflow-hidden bg-white sm:min-h-[400px]" style={{ maxHeight: "680px" }}>
      {/* Background Image Layer */}
      <div className="absolute inset-0">
        <Image
          src={resolvedHeroImage}
          alt="Comfortable feeding setup"
          fill
          className="object-cover object-[center_65%]"
          priority
          fetchPriority="high"
          sizes="100vw"
        />
        {/* Subtle overlay for text readability, gradient on desktop */}
        <div className="absolute inset-0 bg-black/10 lg:bg-gradient-to-r lg:from-black/60 lg:via-black/20 lg:to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex min-h-[390px] items-start pt-10 pb-8 sm:min-h-[400px] sm:pt-12 lg:items-center lg:py-12">
        <div className="mx-auto flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:justify-start">
          <div className="flex w-full max-w-[440px] flex-col items-center text-center lg:items-start lg:text-left">
            {/* Obsidian Glass Box */}
            <div className="w-full max-w-[440px] rounded-2xl border border-white/20 bg-black/20 p-5 shadow-2xl backdrop-blur-[4px] sm:p-6 lg:px-10 lg:py-8">
              <h1 className="mb-4 text-[22px] font-black uppercase leading-[1.3] tracking-[0.06em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-[24px] md:text-[30px] md:tracking-[0.08em]" style={{ fontFamily: 'var(--font-hanken)' }}>
                Better Products for the<br />
                Way Your Dog Is Built.
              </h1>

              <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-relaxed tracking-[0.02em] text-white drop-shadow-sm lg:mx-0 md:text-[15px]">
                Breed-focused guides and thoughtfully selected products for feeding, comfort, mobility and walking.
              </p>

              <div className="flex w-full flex-col justify-center gap-2 min-[360px]:flex-row md:gap-4 lg:justify-start">
                <Link
                  href="/dogs"
                  className="w-full bg-secondary px-3 py-3.5 text-center text-sm font-bold uppercase tracking-[0.02em] text-ink shadow-md transition-colors hover:bg-secondary-dark min-[360px]:flex-1 lg:px-7 lg:tracking-[0.04em]"
                  style={{ fontFamily: 'var(--font-lato)', whiteSpace: 'nowrap' }}
                >
                  Find Your Breed
                </Link>
                <Link
                  href="/shop/solutions"
                  className="w-full bg-white px-3 py-3.5 text-center text-sm font-bold uppercase tracking-[0.02em] text-primary shadow-md transition-colors hover:bg-gray-100 min-[360px]:flex-1 lg:px-7 lg:tracking-[0.04em]"
                  style={{ fontFamily: 'var(--font-lato)', whiteSpace: 'nowrap' }}
                >
                  Explore Solutions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
