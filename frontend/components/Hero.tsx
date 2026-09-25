"use client";

import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";

const DEFAULT_HERO_IMAGE = "/assets/banner/hero-banner-homepage.webp";

export default function Hero({ heroImage }: { heroImage?: string | null }) {
  const resolvedHeroImage = heroImage || DEFAULT_HERO_IMAGE;

  return (
    <section className="relative min-h-[352px] w-full overflow-hidden bg-white sm:min-h-[400px]" style={{ maxHeight: "680px" }}>
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
        {/* Stronger mobile overlay keeps the copy legible against bright hero images. */}
        <div className="absolute inset-0 bg-black/30 lg:bg-gradient-to-r lg:from-black/60 lg:via-black/20 lg:to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex min-h-[352px] items-start py-5 sm:min-h-[400px] sm:pt-12 sm:pb-8 lg:items-center lg:py-12">
        <div className="mx-auto flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:justify-start">
          <div className="flex w-full max-w-[440px] flex-col items-center text-center sm:max-w-[540px] lg:max-w-fit lg:items-start lg:text-left">
            {/* Obsidian Glass Box */}
            <div className="w-full max-w-[440px] rounded-2xl border border-white/20 bg-black/20 p-5 shadow-2xl backdrop-blur-[4px] sm:max-w-[540px] sm:p-6 lg:max-w-none lg:px-10 lg:py-8">
              <h1 className="mb-4 text-[20px] font-black uppercase leading-[1.3] tracking-[0.045em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] min-[360px]:text-[22px] sm:text-[24px] md:text-[30px] md:tracking-[0.08em]" style={{ fontFamily: 'var(--font-hanken)' }}>
                <span className="lg:hidden">Better Products for the Way Your Dog Is Built.</span>
                <span className="hidden lg:inline">Better Products for the<br />Way Your Dog Is Built.</span>
              </h1>

              <p className="mx-auto mb-6 max-w-[420px] text-[13px] leading-relaxed tracking-[0.02em] text-white drop-shadow-sm lg:mx-0 sm:text-[14px] md:text-[15px]">
                Breed-focused guides and thoughtfully selected products for feeding, comfort, mobility and walking.
              </p>

              <div className="flex w-full flex-col justify-center gap-3 sm:flex-row sm:justify-start md:gap-4">
                <ButtonLink
                  href="/dogs"
                  variant="primary"
                  className="w-full shadow-none sm:w-auto"
                  style={{
                    fontFamily: 'var(--font-lato)',
                    whiteSpace: 'nowrap',
                    height: 'auto',
                    padding: '16px 40px',
                    borderRadius: 3,
                    fontSize: 14,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                  }}
                >
                  Find Your Breed
                </ButtonLink>
                <ButtonLink
                  href="/shop/solutions"
                  variant="secondary"
                  className="w-full shadow-none hover:bg-zinc-200 sm:w-auto"
                  style={{
                    fontFamily: 'var(--font-lato)',
                    whiteSpace: 'nowrap',
                    height: 'auto',
                    padding: '16px 40px',
                    borderRadius: 3,
                    fontSize: 14,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                    borderWidth: 0,
                  }}
                >
                  Explore Solutions
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
