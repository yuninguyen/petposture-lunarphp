"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Add this line
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import type { Product } from '@/types/shop';
import { API_BASE_URL as apiBaseUrl } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { stripHtml } from '@/lib/text';

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS
 ───────────────────────────────────────────────────────────────── */
import { C, F } from '@/lib/uiTheme';

/* ── TypeScript Interfaces ──────────────────────────────────────── */

interface BlogPost {
  slug: string;
  cat: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  img: string | null;
}

/* ─────────────────────────────────────────────────────────────────
   SHARED COMPONENTS
 ───────────────────────────────────────────────────────────────── */
function Btn({
  children, variant = 'solid', href = '#', style = {}
}: {
  children: React.ReactNode;
  variant?: 'solid' | 'outline' | 'outlineWhite' | 'white' | 'ghost';
  href?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '12px 24px', borderRadius: 3, /* ~tokens --radius-sm */
    fontFamily: F.nav, fontSize: 12, fontWeight: 700,
    letterSpacing: '0.03em', textTransform: 'uppercase',
    border: '2px solid', cursor: 'pointer',
    transition: 'all 0.2s ease', textDecoration: 'none',
    whiteSpace: 'nowrap', lineHeight: 1,
  };
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: C.secondaryText, borderColor: C.secondaryText, color: C.ink },
    outline: { background: 'transparent', borderColor: C.primary, color: C.primary },
    outlineWhite: { background: 'transparent', borderColor: C.white, color: C.white },
    white: { background: C.white, borderColor: C.white, color: C.primary },
    ghost: { background: 'transparent', borderColor: 'transparent', color: C.secondaryText },
  };
  const hoverStyles: Record<string, React.CSSProperties> = {
    solid: { background: C.secondaryTextHover, borderColor: C.secondaryTextHover },
    outline: { background: C.secondary, borderColor: C.secondary, color: C.white },
    outlineWhite: { background: 'rgba(255,255,255,0.15)' },
    white: { background: '#e8eaec', borderColor: '#e8eaec' },
    ghost: { color: C.secondaryTextHover },
  };
  return (
    <Link
      href={href}
      style={{ ...base, ...styles[variant], ...style, ...(hovered ? hoverStyles[variant] : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  );
}

function SectionTitle({
  children, sub, align = 'center'
}: {
  children: React.ReactNode;
  sub?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div style={{ textAlign: align, marginBottom: 56 }}>
      <h2 style={{
        fontFamily: F.heading, fontSize: 'clamp(26px, 3.2vw, 36px)',
        fontWeight: 700, letterSpacing: '0.01em',
        color: C.primary, margin: '0 0 16px',
      }}>
        {children}
      </h2>
      <div style={{
        width: 44, height: 3,
        background: `linear-gradient(90deg, ${C.secondary}, ${C.secondaryHover})`,
        borderRadius: 2,
        margin: align === 'center' ? '0 auto' : '0',
        marginBottom: sub ? 20 : 0,
      }} />
      {sub && (
        <p style={{
          fontFamily: F.body, fontSize: 15, color: C.grayText,
          lineHeight: 1.7, maxWidth: 560,
          margin: align === 'center' ? '20px auto 0' : '20px 0 0',
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SOCIAL PROOF STRIP  (below Hero)
 ───────────────────────────────────────────────────────────────── */
function SocialProofStrip() {
  const stats = [
    {
      value: 'Breed-Focused',
      label: 'Designed around specific dog body types and everyday use.',
      accent: '#4f9cf9',
      img: '/assets/Trust-Breed-Focused.png',
    },
    {
      value: 'Curated Selection',
      label: 'A smaller selection of relevant products, not an endless catalog.',
      accent: '#f5a623',
      img: '/assets/Trust-Curated-Selection.png',
    },
    {
      value: '30-Day Guarantee',
      label: 'Love it or return it within 30 days of delivery.',
      accent: '#38c68b',
      img: '/assets/Trust-30-Day-Guarantee.png',
    },
    {
      value: 'Free Shipping $50+',
      label: 'Free standard shipping on orders over $50 in the US.',
      accent: C.secondary,
      img: '/assets/Trust-Free-Shipping.png',
    },
  ];

  return (
    <div style={{ background: C.white, padding: '32px 24px', borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex items-center text-left gap-3"
          >
            <div style={{
              position: 'relative',
              width: 48, height: 48, flexShrink: 0, borderRadius: '50%',
              background: `${s.accent}26`,
            }}>
              <Image src={s.img} alt={s.value} fill sizes="48px" className="object-contain p-1.5" />
            </div>
            <div>
              <div style={{
                fontFamily: F.heading, fontSize: 14, fontWeight: 700,
                color: C.primary, marginBottom: 2,
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: F.body, fontSize: 12, lineHeight: 1.4,
                color: C.grayText,
              }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SHOP WHAT YOU NEED
 ───────────────────────────────────────────────────────────────── */
function ShopCategories() {
  const [hoveredBreed, setHoveredBreed] = useState<string | null>(null);
  const [hoveredSolution, setHoveredSolution] = useState<string | null>(null);
  const [activeBreedSlide, setActiveBreedSlide] = useState(0);
  const [activeSolutionSlide, setActiveSolutionSlide] = useState(0);

  const makeScrollHandler = (count: number, setter: (i: number) => void) =>
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const progress = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
      setter(Math.round(progress * (count - 1)));
    };

  const breeds = [
    { name: 'Dachshund', slug: 'dachshund', img: '/assets/Breed-Dachshund.png' },
    { name: 'French Bulldog', slug: 'french-bulldog', img: '/assets/Breed-French-Bulldog.png' },
    { name: 'Pug', slug: 'pug', img: '/assets/Breed-Pug.png' },
    { name: 'Corgi', slug: 'corgi', img: '/assets/Breed-Corgi.png' },
    { name: 'English Bulldog', slug: 'bulldog', img: '/assets/Breed-English-Bulldog.png' },
  ];

  const solutions = [
    { name: 'Feeding', slug: 'feeding', accent: '#f5a623', img: '/assets/Icon-Feeding.png' },
    { name: 'Comfort', slug: 'comfort', accent: '#e0685c', img: '/assets/Icon-Comfort.png' },
    { name: 'Mobility', slug: 'mobility', accent: '#8a9a4e', img: '/assets/Icon-Mobility.png' },
    { name: 'Walking', slug: 'walking', accent: '#5fa88a', img: '/assets/Icon-Walking.png' },
  ];

  return (
    <section style={{ background: C.grayLight, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Start with your dog's breed or the everyday challenge you're trying to solve.">
          Find What Fits Your Dog
        </SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Shop by Breed */}
          <div style={{ background: '#f6faff', borderRadius: 16, padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-start gap-4 mb-6">
              <div style={{
                position: 'relative',
                width: 48, height: 48, flexShrink: 0, borderRadius: '50%',
                background: '#dbe7f7',
              }}>
                <Image src="/assets/Icon-Header-Breed.png" alt="Shop by Breed" fill sizes="48px" className="object-contain p-2" />
              </div>
              <div>
                <h3 style={{ fontFamily: F.heading, fontSize: 20, fontWeight: 700, color: C.primary, margin: '0 0 4px' }}>
                  Shop by Breed
                </h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.grayText, margin: 0, lineHeight: 1.5 }}>
                  Find products and guides tailored to your dog&apos;s breed.
                </p>
              </div>
            </div>
            <div
              className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-5 gap-3 mb-4 sm:mb-6"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              onScroll={makeScrollHandler(breeds.length, setActiveBreedSlide)}
            >
              {breeds.map((b) => (
                <Link
                  key={b.slug}
                  href={`/dogs/${b.slug}`}
                  className="text-center shrink-0 basis-[30%] sm:basis-auto snap-start"
                  onMouseEnter={() => setHoveredBreed(b.slug)}
                  onMouseLeave={() => setHoveredBreed(null)}
                >
                  <div style={{
                    position: 'relative', aspectRatio: '4 / 5', borderRadius: 12,
                    overflow: 'hidden', background: C.grayLight, marginBottom: 8,
                    boxShadow: hoveredBreed === b.slug ? '0 10px 22px rgba(0,0,0,0.18)' : '0 2px 6px rgba(0,0,0,0.06)',
                    transform: hoveredBreed === b.slug ? 'translateY(-3px)' : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                    <Image src={b.img} alt={b.name} fill sizes="120px" className="object-cover" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30 }}>
                    <span style={{
                      fontFamily: F.body, fontSize: 11.5, fontWeight: 700, lineHeight: 1.25,
                      color: hoveredBreed === b.slug ? C.secondary : C.primary,
                      transition: 'color 0.2s ease',
                    }}>
                      {b.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="flex sm:hidden justify-center gap-2 mb-6">
              {breeds.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: activeBreedSlide === idx ? 20 : 6,
                    height: 6, borderRadius: 3,
                    background: activeBreedSlide === idx ? C.secondary : C.border,
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
            <Link href="/shop/breeds" style={{
              display: 'block', textAlign: 'center', fontFamily: F.nav,
              fontSize: 12, fontWeight: 800, color: C.secondary,
              textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none',
              marginTop: 'auto',
            }}>
              View All Breeds →
            </Link>
          </div>

          {/* Shop by Solutions */}
          <div style={{ background: '#fdf7f0', borderRadius: 16, padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-start gap-4 mb-6">
              <div style={{
                position: 'relative',
                width: 48, height: 48, flexShrink: 0, borderRadius: '50%',
                background: '#f6e2c8',
              }}>
                <Image src="/assets/Icon-Header-Solutions.png" alt="Shop by Solutions" fill sizes="48px" className="object-contain p-2" />
              </div>
              <div>
                <h3 style={{ fontFamily: F.heading, fontSize: 20, fontWeight: 700, color: C.primary, margin: '0 0 4px' }}>
                  Shop by Solutions
                </h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.grayText, margin: 0, lineHeight: 1.5 }}>
                  Explore products by the everyday needs you&apos;re looking to solve.
                </p>
              </div>
            </div>
            <div
              className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-4 gap-3 mb-4 sm:mb-6"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              onScroll={makeScrollHandler(solutions.length, setActiveSolutionSlide)}
            >
              {solutions.map((s) => (
                <Link
                  key={s.slug}
                  href={`/solutions/${s.slug}`}
                  className="flex flex-col items-center gap-2 shrink-0 basis-[30%] sm:basis-auto snap-start"
                  onMouseEnter={() => setHoveredSolution(s.slug)}
                  onMouseLeave={() => setHoveredSolution(null)}
                >
                  <div style={{
                    position: 'relative',
                    width: 88, height: 88, borderRadius: '50%',
                    background: `${s.accent}${hoveredSolution === s.slug ? '3d' : '26'}`,
                    transform: hoveredSolution === s.slug ? 'translateY(-3px) scale(1.05)' : 'none',
                    boxShadow: hoveredSolution === s.slug ? `0 8px 20px ${s.accent}33` : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                    <Image src={s.img} alt={s.name} fill sizes="88px" className="object-contain p-1.5" />
                  </div>
                  <span style={{
                    fontFamily: F.body, fontSize: 12.5, fontWeight: 600, textAlign: 'center',
                    color: hoveredSolution === s.slug ? s.accent : C.primary,
                    transition: 'color 0.2s ease',
                  }}>
                    {s.name}
                  </span>
                </Link>
              ))}
            </div>
            <div className="flex sm:hidden justify-center gap-2 mb-6">
              {solutions.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: activeSolutionSlide === idx ? 20 : 6,
                    height: 6, borderRadius: 3,
                    background: activeSolutionSlide === idx ? C.secondary : C.border,
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
            <Link href="/shop/solutions" style={{
              display: 'block', textAlign: 'center', fontFamily: F.nav,
              fontSize: 12, fontWeight: 800, color: C.secondary,
              textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none',
              marginTop: 'auto',
            }}>
              View All Solutions →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WHY CHOOSE PETPOSTURE
 ───────────────────────────────────────────────────────────────── */
function WhyChoose() {
  const features = [
    {
      img: '/assets/Why-Breed-Focused.png',
      title: 'Breed-Focused',
      desc: 'We consider body type, size and everyday use so products make more sense for your dog.',
      accent: '#4f9cf9',
    },
    {
      img: '/assets/Why-Practical-Research.png',
      title: 'Practical Research',
      desc: 'We look at fit, materials, sizing and usability-not just what\'s popular.',
      accent: '#38c68b',
    },
    {
      img: '/assets/Why-Carefully-Selected.png',
      title: 'Carefully Selected',
      desc: 'We would rather recommend a smaller number of relevant products than an endless catalog.',
      accent: '#f5a623',
    },
    {
      img: '/assets/Why-Transparent-Reviews.png',
      title: 'Transparent Reviews',
      desc: 'We clearly distinguish between products we\'ve researched and products we\'ve physical tested.',
      accent: C.secondary,
    },
  ];

  return (
    <section className="hidden sm:block" style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Every product engineered with a specific body type in mind.">
          Why Choose PetPosture
        </SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-0">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`flex items-start text-left gap-3 ${i % 2 !== 0 ? 'border-l' : 'border-l-0'} ${i % 4 !== 0 ? 'lg:border-l' : 'lg:border-l-0'} border-zinc-200`}
              style={{
                padding: '8px 20px',
                cursor: 'default',
              }}
            >
              <div style={{ position: 'relative', width: 58, height: 58, flexShrink: 0, marginTop: 2 }}>
                <Image src={f.img} alt={f.title} fill sizes="58px" className="object-contain" />
              </div>

              <div>
                <h3 style={{
                  fontFamily: F.heading, fontSize: 14, fontWeight: 700,
                  color: C.primary, marginBottom: 4,
                }}>
                  {f.title}
                </h3>
                <p style={{
                  color: C.grayText, fontSize: 12.5, lineHeight: 1.5, margin: 0,
                }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   OUR BEST SELLERS
 ───────────────────────────────────────────────────────────────── */
function BestSellers() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/products?category=best-sellers`);
        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.status}`);
        }
        const data = await response.json();
        setProducts(data.data.slice(0, 4)); // Only show first 4
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load products.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <section style={{ background: C.white, padding: '40px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <SectionTitle sub="Loading our most-loved products...">
            PetPosture Picks
          </SectionTitle>
          <p style={{ color: C.grayText }}>Loading products...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ background: C.white, padding: '40px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <SectionTitle sub="Failed to load products.">
            PetPosture Picks
          </SectionTitle>
          <p style={{ color: C.primary, fontWeight: 600 }}>Error: {error}</p>
          <p style={{ color: C.grayText }}>Please check the API connection or try again later.</p>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section style={{ background: C.white, padding: '40px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <SectionTitle sub="No products available at the moment.">
            PetPosture Picks
          </SectionTitle>
          <p style={{ color: C.grayText }}>Please check back soon!</p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="A curated selection chosen around the dogs and everyday needs we focus on.">
          PetPosture Picks
        </SectionTitle>
        <div
          className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 md:gap-8"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          {products.map((p) => (
            <div key={p.variantId} className="w-[72%] shrink-0 snap-start sm:w-auto">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Btn variant="outline" href="/shop" style={{ padding: '14px 36px', fontSize: 12 }}>
            View All Products
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MEALTIME DIFFERENCE
 ───────────────────────────────────────────────────────────────── */
function MealtimeDiff() {
  const points = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-500">
          <path d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bold: 'The Problem:',
      text: 'Many pet products are designed for a broad range of dogs. But body shape, size and everyday habits can affect which products feel practical for a particular dog.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-500">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bold: 'The PetPosture Approach:',
      text: "PetPosture organizes products and guides around breed, body type and everyday use — helping owners narrow down the options.",
    },
  ];

  return (
    <section style={{ background: C.grayLight, padding: '56px 24px' }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-20 lg:items-start">

          {/* 1 & 2: Badge & Title (Mobile: Top, Desktop: Right Column, Row 1) */}
          <div className="order-1 lg:col-start-2 lg:row-start-1 flex flex-col items-center text-center lg:items-start lg:text-left mb-10 lg:mb-12">
            <div style={{
              display: 'inline-block',
              fontFamily: F.nav, fontSize: 10, fontWeight: 800,
              color: C.secondary, letterSpacing: '0.14em',
              textTransform: 'uppercase', marginBottom: 20,
              background: C.white,
              padding: '6px 16px',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}>
              The Ergonomic Difference
            </div>

            <h2 style={{
              fontFamily: F.heading, fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: 700, color: C.primary, lineHeight: 1.2,
              textTransform: 'capitalize', letterSpacing: '0.01em',
              margin: 0,
            }}>
              Not Every Product Fits<br className="hidden lg:block" /> Every Dog the Same Way.
            </h2>
          </div>

          {/* 3. Image (Mobile: Middle, Desktop: Left Column, Row 2) */}
          <div className="order-2 lg:col-start-1 lg:row-start-2 mb-12 lg:mb-0" style={{
            background: C.white,
            padding: 20, borderRadius: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
            border: `1px solid ${C.border}`,
            width: '100%',
          }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden' }}>
              <Image
                src="/assets/dog-sofa.png"
                alt="Dog using a ramp to safely access a couch"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>

          {/* 4. Content (Mobile: Bottom, Desktop: Right Column, Row 2) */}
          <div className="order-3 lg:col-start-2 lg:row-start-2">
            <div className="grid grid-cols-1 gap-6 w-full text-left mb-10">
              {points.map(item => (
                <div key={item.bold} style={{
                  display: 'flex', gap: 16,
                  padding: '24px',
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                }}>
                  <span style={{ flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <p style={{ fontSize: 15, color: C.primary, lineHeight: 1.7, margin: 0 }}>
                    <strong style={{ color: C.primary, display: 'block', marginBottom: 6, fontSize: 16 }}>{item.bold}</strong>{' '}
                    <span className="text-gray-600">{item.text}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-center lg:justify-start">
              <Btn variant="solid" href="/our-mission" style={{ padding: '16px 40px', fontSize: 14 }}>
                Our Mission &amp; Method →
              </Btn>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   BREED BANNERS
 ───────────────────────────────────────────────────────────────── */
function BreedBanners() {
  const [hovered, setHovered] = useState<number | null>(null);

  const breeds = [
    {
      slug: 'flat-faced',
      title: 'Flat-Faced Dogs',
      sub: 'Pugs, French Bulldogs and English Bulldogs have distinctive body and head shapes that can influence product fit and everyday usability.',
      img: '/assets/Breed-French-Bulldog.png',
    },
    {
      slug: 'long-backed',
      title: 'Long-Backed & Low-Bodied Dogs',
      sub: 'Dachshunds and Corgis have body proportions that make mobility, furniture access and product sizing especially worth considering.',
      img: '/assets/Breed-Corgi.png',
    },
  ];

  return (
    <section style={{ background: C.white, padding: '56px 24px' }}>
      <div style={{ maxWidth: 1210, margin: '0 auto' }}>
        <SectionTitle sub="Body shape can influence which products are more comfortable and practical.">
          Explore by Body Type
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {breeds.map((breed, idx) => (
            <Link
              key={breed.slug}
              href={`/shop/breeds/${breed.slug}`}
              className="flex items-stretch"
              style={{
                borderRadius: 8, overflow: 'hidden',
                background: C.grayLight,
                transition: 'transform 0.3s ease',
                transform: hovered === idx ? 'scale(1.012)' : 'scale(1)',
              }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ position: 'relative', width: '38%', flexShrink: 0 }}>
                <Image
                  src={breed.img}
                  alt={breed.title}
                  fill
                  sizes="(max-width: 768px) 40vw, 20vw"
                  className="object-cover"
                />
              </div>
              <div style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center',
                padding: '28px 32px',
              }}>
                <h3 style={{
                  fontFamily: F.heading, fontSize: 'clamp(18px, 2vw, 22px)',
                  fontWeight: 700, color: C.primary,
                  margin: '0 0 10px',
                }}>
                  {breed.title}
                </h3>
                <p style={{
                  color: C.grayText,
                  fontSize: 14, margin: '0 0 18px', lineHeight: 1.6,
                }}>
                  {breed.sub}
                </p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: F.nav, fontSize: 12, fontWeight: 800,
                  color: C.secondary, letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Explore →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Insight
 ───────────────────────────────────────────────────────────────── */
function PostCard({ post }: { post: BlogPost }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        background: post.img ? '#c0cdd4' : C.grayMid,
        aspectRatio: '16/9', borderRadius: 6, marginBottom: 20,
        overflow: 'hidden', position: 'relative',
      }}>
        {post.img ? (
          <Image
            src={post.img}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{
              objectFit: 'cover',
              transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${C.grayLight} 0%, ${C.grayMid} 100%)`,
          }}>
            <span style={{ fontSize: 40, opacity: 0.4 }}>🐾</span>
          </div>
        )}
      </div>

      {/* Category Badge */}
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 800,
        color: C.rust,
        background: C.secondaryLight,
        border: `1px solid rgba(223,132,72,0.2)`,
        padding: '3px 10px', borderRadius: 2,
        letterSpacing: '0.12em', marginBottom: 12,
        textTransform: 'uppercase',
      }}>
        {post.cat}
      </div>

      <h3 style={{
        fontFamily: F.heading, fontSize: 16, fontWeight: 700,
        color: isHovered ? C.secondary : C.primary,
        lineHeight: 1.5, margin: '0 0 10px',
        transition: 'color 0.25s ease',
      }}>
        {post.title}
      </h3>

      <p style={{ fontSize: 15, color: C.grayText, margin: '0 0 12px', lineHeight: 1.6 }}>
        {post.excerpt}
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: F.nav,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700,
          color: isHovered ? C.secondary : C.grayText,
          letterSpacing: '0.05em', textTransform: 'capitalize',
          transition: 'color 0.25s ease',
        }}>
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700,
          color: C.secondary,
        }}>
          Read →
        </div>
      </div>
    </Link>
  );
}

function Insights() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const index = Math.round(el.scrollLeft / (el.clientWidth * 0.85));
    if (index !== activeSlide) setActiveSlide(index);
  };

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiBaseUrl}/api/posts`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        setPosts(
          rows.slice(0, 3).map((p: {
            slug: string;
            title: string;
            content?: string;
            featured_image?: string | null;
            read_time?: string | null;
            published_at?: string | null;
            created_at?: string | null;
            blog_category?: { name?: string } | null;
          }) => ({
            slug: p.slug,
            cat: p.blog_category?.name || 'Insights',
            title: p.title,
            excerpt: stripHtml(p.content || '').slice(0, 140),
            date: formatDate(p.published_at || p.created_at || new Date().toISOString()),
            readTime: p.read_time || '5 min read',
            img: p.featured_image || null,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && posts.length === 0) {
    return null;
  }

  return (
    <section style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Expert guides, breed-specific tips, and health insights for pet parents.">
          Lastest PetPosture Guides
        </SectionTitle>
        <div
          className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          onScroll={handleScroll}
        >
          {posts.map((post, i) => (
            <div key={i} className="min-w-[85vw] sm:min-w-0 snap-center">
              <PostCard post={post} />
            </div>
          ))}
        </div>

        {/* Mobile Pagination Dots */}
        <div className="flex sm:hidden justify-center gap-2 mt-8">
          {posts.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: activeSlide === idx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: activeSlide === idx ? C.secondary : C.border,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Btn variant="outline" href="/blog" style={{ padding: '14px 36px', fontSize: 12 }}>
            View All Articles
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PAGE ROOT
 ───────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-grow">
        <Hero />
        <SocialProofStrip />
        <ShopCategories />
        <WhyChoose />
        <BestSellers />
        <MealtimeDiff />
        <BreedBanners />
        <Insights />
      </main>
      <Footer />
    </div>
  );
}
