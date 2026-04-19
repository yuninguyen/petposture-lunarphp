"use client";

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS
 ───────────────────────────────────────────────────────────────── */
const C = {
  primary: '#3e4c57',
  primaryHover: '#2c3840',
  secondary: '#df8448',
  secondaryHover: '#c9713a',
  secondaryLight: '#fdf2ea',
  white: '#ffffff',
  grayLight: '#f4f5f6',
  grayMid: '#e8eaec',
  grayText: '#6b7280',
  border: '#e2e5e8',
  borderHover: '#c8cdd2',
};

const F = {
  heading: "var(--font-hanken), sans-serif",
  body: "var(--font-hanken), sans-serif",
  nav: "var(--font-lato), sans-serif",
  alt: "var(--font-dancing), cursive",
};

/* ── TypeScript Interfaces ──────────────────────────────────────── */
interface Product {
  id: number;
  category: string;
  name: string;
  price: string;
  reviews: number;
  emoji: string;
  isNew: boolean;
}

interface BlogPost {
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
    letterSpacing: '0.1em', textTransform: 'uppercase',
    border: '2px solid', cursor: 'pointer',
    transition: 'all 0.2s ease', textDecoration: 'none',
    whiteSpace: 'nowrap', lineHeight: 1,
  };
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: C.secondary, borderColor: C.secondary, color: C.white },
    outline: { background: 'transparent', borderColor: C.primary, color: C.primary },
    outlineWhite: { background: 'transparent', borderColor: C.white, color: C.white },
    white: { background: C.white, borderColor: C.white, color: C.primary },
    ghost: { background: 'transparent', borderColor: 'transparent', color: C.secondary },
  };
  const hoverStyles: Record<string, React.CSSProperties> = {
    solid: { background: C.secondaryHover, borderColor: C.secondaryHover },
    outline: { background: C.secondary, borderColor: C.secondary, color: C.white },
    outlineWhite: { background: 'rgba(255,255,255,0.15)' },
    white: { background: '#e8eaec', borderColor: '#e8eaec' },
    ghost: { color: C.secondaryHover },
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
        fontFamily: F.heading, fontSize: 'clamp(22px, 2.8vw, 30px)',
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
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
    { value: '10,000+', label: 'Happy Pets' },
    { value: '4.9★', label: 'Average Rating' },
    { value: '30-Day', label: 'Money-Back Guarantee' },
    { value: 'Free', label: 'Shipping Over $50' },
  ];

  return (
    <div style={{
      background: C.primary,
      padding: '0 24px',
    }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4 border-l border-white/10">
        {stats.map((s, i) => (
          <div key={i} className={`
            py-6 px-4 border-r border-white/10 text-center flex flex-col items-center justify-center
            ${i < 2 ? 'border-b' : ''} lg:border-b-0
          `}>
            <div style={{
              fontFamily: F.heading, fontSize: 24, fontWeight: 700,
              color: C.secondary, marginBottom: 2, letterSpacing: '-0.01em',
            }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: F.nav, fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.8)', letterSpacing: '0.12em',
              textTransform: 'uppercase', lineHeight: 1.2,
            }}>
              {s.label}
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const panels = [
    {
      label: 'Shop by Breeds',
      desc: 'Ergonomic essentials tailored to your breed\'s unique anatomy — from flat-faced Pugs to long-backed Dachshunds.',
      bg: `#5a6a74 url('/assets/Shop-by-Breed.jpg') center/cover no-repeat`,
      align: 'flex-end' as const,
      textAlign: 'right' as const,
      buttons: [
        { label: 'Flat-Faced Breeds', href: '/shop/flat-faced', variant: 'solid' as const },
        { label: 'Long-Backed Breeds', href: '/shop/long-backed', variant: 'outlineWhite' as const },
      ],
    },
    {
      label: 'Shop by Solutions',
      desc: 'Target your pet\'s specific health concerns — digestion, mobility, joint support, and everyday comfort.',
      bg: `#7a8a8f url('/assets/shop-by-solutions.jpg') center/cover no-repeat`,
      align: 'flex-start' as const,
      textAlign: 'left' as const,
      buttons: [
        { label: 'Digestion', href: '/shop/digestion', variant: 'white' as const },
        { label: 'Mobility', href: '/shop/mobility', variant: 'white' as const },
        { label: 'Comfort', href: '/shop/comfort', variant: 'white' as const },
      ],
    },
  ];

  return (
    <section style={{ background: C.grayLight, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Designed around your pet's body, not generic one-size solutions.">
          Shop What You Need
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {panels.map((p, i) => (
            <div
              key={i}
              style={{
                minHeight: 340,
                background: `linear-gradient(to bottom,
                  rgba(30,38,44,0.38) 0%,
                  rgba(30,38,44,0.55) 60%,
                  rgba(30,38,44,0.75) 100%),
                  ${p.bg}`,
                display: 'flex', flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: p.align,
                padding: '40px 36px',
                textAlign: p.textAlign,
                cursor: 'pointer',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                transform: hoveredIdx === i ? 'translateY(-4px)' : 'none',
                boxShadow: hoveredIdx === i
                  ? '0 20px 48px rgba(0,0,0,0.2)'
                  : '0 4px 16px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{
                display: 'inline-block',
                fontSize: 11, fontWeight: 800,
                color: C.secondary,
                background: C.white,
                border: 'none',
                padding: '4px 10px', borderRadius: 2,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                Browse Collection
              </div>
              <h3 style={{
                fontFamily: F.heading, fontSize: 'clamp(20px, 2.5vw, 26px)',
                fontWeight: 700, color: C.white,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                margin: '0 0 12px', maxWidth: 340,
                minHeight: 56, display: 'flex', alignItems: 'flex-end',
              }}>
                {p.label}
              </h3>
              <p style={{
                color: 'rgba(255,255,255,0.82)', fontSize: 15,
                margin: '0 0 28px', maxWidth: 360,
                lineHeight: 1.7, letterSpacing: '0.01em',
                minHeight: 76,
              }}>
                {p.desc}
              </p>
              <div className="flex flex-row gap-2 md:gap-3 w-full" style={{
                justifyContent: p.align,
                maxWidth: p.buttons.length === 2 ? 460 : 540,
              }}>
                {p.buttons.map(b => (
                  <div key={b.label} style={{ flex: 1, display: 'flex' }}>
                    <Btn variant={b.variant} href={b.href} style={{
                      fontSize: '11px',
                      padding: '10px 4px',
                      width: '100%',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      {b.label}
                    </Btn>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WHY CHOOSE PETPOSTURE
 ───────────────────────────────────────────────────────────────── */
function WhyChoose() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const index = Math.round(el.scrollLeft / (el.clientWidth * 0.85));
    if (index !== activeSlide) setActiveSlide(index);
  };

  const features = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M4 16h24M4 11h9M4 21h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="17" y="9" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="7" cy="25" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="26" cy="25" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
      title: 'Ships in 24 Hours',
      desc: 'Every order is packed and shipped from our US warehouse within one business day.',
      accent: '#4f9cf9',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4C9.37 4 4 9.37 4 16s5.37 12 12 12 12-5.37 12-12S22.63 4 16 4Z" stroke="currentColor" strokeWidth="2" />
          <path d="M11 16l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: '30-Day Guarantee',
      desc: 'Not satisfied? Return it hassle-free within 30 days — no questions asked.',
      accent: '#38c68b',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 5l2.6 6.6H26l-5.8 4.2 2.2 7.2-6.4-4.6-6.4 4.6 2.2-7.2L6 11.6h7.4L16 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Vet-Approved Design',
      desc: 'Our products are developed in collaboration with veterinary ergonomics experts.',
      accent: '#f5a623',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 28s-10-6.4-10-13a7 7 0 0 1 10-6.3A7 7 0 0 1 26 15c0 6.6-10 13-10 13Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Built for Your Breed',
      desc: 'Specialty ergonomics for flat-faced, long-backed, and senior dog breeds.',
      accent: C.secondary,
    },
  ];

  return (
    <section style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Every product engineered with a specific body type in mind.">
          Why Choose PetPosture
        </SectionTitle>
        <div
          className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-0"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          onScroll={handleScroll}
        >
          {features.map((f, i) => (
            <div
              key={f.title}
              className="min-w-[85vw] sm:min-w-0 snap-center"
              style={{
                padding: '48px 32px',
                border: `1px solid ${hoveredIdx === i ? f.accent : C.border}`,
                background: hoveredIdx === i ? '#fafbfc' : C.white,
                textAlign: 'center',
                cursor: 'default',
                transition: 'all 0.25s ease',
                position: 'relative',
                marginLeft: i > 0 ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : -1) : 0,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: hoveredIdx === i ? f.accent : 'transparent',
                transition: 'background 0.25s',
              }} />

              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: hoveredIdx === i ? `${f.accent}20` : C.grayLight,
                color: hoveredIdx === i ? f.accent : C.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px', transition: 'all 0.25s',
              }}>
                {f.icon}
              </div>

              <h4 style={{
                fontFamily: F.heading, fontSize: 18, fontWeight: 700,
                color: C.primary, marginBottom: 12, textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {f.title}
              </h4>
              <p style={{
                color: C.grayText, fontSize: 14, lineHeight: 1.6, margin: 0,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile Pagination Dots */}
        <div className="flex sm:hidden justify-center gap-2 mt-8">
          {features.map((_, idx) => (
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
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   OUR BEST SELLERS
 ───────────────────────────────────────────────────────────────── */
const PRODUCT_COLORS = ['#dde6eb', '#e8ded6', '#dde8e2', '#e8e4d6'];

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={`/product/${product.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div style={{
        background: PRODUCT_COLORS[index % 4],
        aspectRatio: '1/1',
        borderRadius: 4,
        marginBottom: 16,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
          transform: isHovered ? 'scale(1.06)' : 'scale(1)',
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 52, opacity: 0.55 }}>{product.emoji}</span>
        </div>

        {/* Quick-view overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(62,76,87,0.92)',
          color: C.white,
          fontFamily: F.nav, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '12px', textAlign: 'center',
          transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease',
        }}>
          Quick View
        </div>

        {product.isNew && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: C.secondary, color: C.white,
            fontFamily: F.nav, fontSize: 12, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '4px 8px', borderRadius: 2,
          }}>
            New
          </div>
        )}
      </div>

      {/* Category Badge */}
      <div style={{
        display: 'inline-block', fontSize: 12, fontWeight: 800,
        color: C.grayText, background: C.grayLight,
        padding: '3px 8px', borderRadius: 2,
        letterSpacing: '0.1em', marginBottom: 8,
        textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
      }}>
        {product.category}
      </div>

      {/* Name */}
      <div style={{
        fontFamily: F.heading, fontSize: 15, fontWeight: 700,
        color: isHovered ? C.secondary : C.primary,
        marginBottom: 6, lineHeight: 1.4,
        transition: 'color 0.2s ease',
      }}>
        {product.name}
      </div>

      {/* Stars + Price row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 2 }}>
          {'★'.repeat(5)}
          <span style={{ color: C.grayText, marginLeft: 4, fontSize: 12 }}>
            ({product.reviews})
          </span>
        </div>
        <div style={{
          fontFamily: F.heading, fontSize: 15, fontWeight: 700, color: C.primary,
        }}>
          {product.price}
        </div>
      </div>
    </Link>
  );
}

function BestSellers() {
  const products = [
    { id: 1, category: 'ERGONOMIC BOWL', name: 'PosturePro™ Tilted Bowl', price: '$29.00', reviews: 214, emoji: '🥣', isNew: false },
    { id: 2, category: 'MOBILITY', name: 'ErgoStep™ Pet Ramp', price: '$49.00', reviews: 182, emoji: '🪜', isNew: true },
    { id: 3, category: 'ORTHOPEDIC', name: 'ComfortRest™ Memory Bed', price: '$89.00', reviews: 308, emoji: '🛏️', isNew: false },
    { id: 4, category: 'HARNESS', name: 'SpineSave™ Support Harness', price: '$34.00', reviews: 97, emoji: '🦮', isNew: true },
  ];

  return (
    <section style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Our most-loved products — rated 4.9★ by pet parents across the US.">
          Our Best Sellers
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
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
      text: 'Standard pet bowls force flat-faced and long-backed breeds into painful, unnatural eating positions — leading to joint strain, bloating, and breathing issues.',
      bgColor: '#fff5f5',
      borderColor: '#fed7d7'
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-500">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bold: 'The Solution:',
      text: "PetPosture's ergonomic gear is engineered around specific breed anatomy, so every meal, walk, and rest is comfortable and healthy.",
      bgColor: '#f0fff4',
      borderColor: '#c6f6d5'
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
              textTransform: 'uppercase', letterSpacing: '0.05em',
              margin: 0,
            }}>
              Standard Gear Wasn&apos;t<br className="hidden lg:block" /> Built for Your Pet.
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
            <img
              src="/assets/petposture-corgi-1.jpg"
              alt="Ergonomic mealtime difference illustration"
              style={{ width: '100%', display: 'block', borderRadius: 16 }}
            />
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
                Our Mission &amp; Science →
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
      eyebrow: 'Brachycephalic Breeds',
      title: 'For Flat-Faced Breeds',
      sub: 'Pugs, Bulldogs & French Bulldogs benefit most from elevated, tilted bowls and anti-strain harnesses.',
      bg: '#4a5058',
      img: '/assets/Flat-Faced-Breeds.png',
      align: 'flex-end' as const,
      textAlign: 'right' as const,
    },
    {
      eyebrow: 'Chondrodystrophic Breeds',
      title: 'For Long-Backed Breeds',
      sub: 'Dachshunds & Corgis need ramps, orthopedic beds, and harnesses that protect the intervertebral discs.',
      bg: '#3d4a3e',
      img: '/assets/Corgi.png',
      align: 'flex-start' as const,
      textAlign: 'left' as const,
    },
  ];

  return (
    <section style={{ background: C.white, padding: '56px 24px' }}>
      <div className="max-w-[1210px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {breeds.map((breed, idx) => (
          <div
            key={breed.title}
            style={{
              height: 380, borderRadius: 6, overflow: 'hidden',
              background: `linear-gradient(to top,
                rgba(0,0,0,0.78) 0%,
                rgba(0,0,0,0.32) 50%,
                rgba(0,0,0,0.10) 100%),
                ${breed.bg} url('${breed.img}') center/cover no-repeat`,
              display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: breed.align,
              textAlign: breed.textAlign,
              padding: '44px 48px',
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              transform: hovered === idx ? 'scale(1.012)' : 'scale(1)',
            }}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{
              display: 'inline-block',
              fontFamily: F.nav, fontSize: 11, fontWeight: 800,
              color: C.secondary, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 14,
              background: C.white,
              padding: '6px 16px',
              borderRadius: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}>
              {breed.eyebrow}
            </div>
            <h3 style={{
              fontFamily: F.heading, fontSize: 'clamp(20px, 2.5vw, 26px)',
              fontWeight: 700, color: C.white,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              margin: '0 0 12px', maxWidth: 320,
            }}>
              {breed.title}
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.78)',
              fontSize: 15, margin: '0 0 28px', maxWidth: 320, lineHeight: 1.7,
            }}>
              {breed.sub}
            </p>
            <Btn variant="solid" style={{ fontSize: 12, padding: '11px 22px' }}>
              Shop Now →
            </Btn>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   TESTIMONIALS
 ───────────────────────────────────────────────────────────────── */
function Testimonials() {
  const [activeSlide, setActiveSlide] = useState(0);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const index = Math.round(el.scrollLeft / (el.clientWidth * 0.85));
    if (index !== activeSlide) setActiveSlide(index);
  };

  const reviews = [
    {
      heading: 'The Perfect Pug Bowl!',
      quote: "The tilted bowl has been a game-changer for my pug's digestion! No more coughing or regurgitating after meals.",
      author: 'Ryan R.',
      location: 'Austin, TX',
      initials: 'RR',
      color: '#4f9cf9',
      product: 'PosturePro™ Tilted Bowl',
    },
    {
      heading: 'Worth Every Penny',
      quote: 'My dachshund uses his ramp every single day. I feel so much better knowing he\'s not jumping and hurting his back on the couch.',
      author: 'Bret S.',
      location: 'Seattle, WA',
      initials: 'BS',
      color: '#38c68b',
      product: 'ErgoStep™ Pet Ramp',
    },
    {
      heading: 'Morning Stiffness Is Gone',
      quote: 'This orthopedic bed is incredible. My 11-year-old Corgi is more mobile in the mornings than he\'s been in years.',
      author: 'Kelly O.',
      location: 'Chicago, IL',
      initials: 'KO',
      color: C.secondary,
      product: 'ComfortRest™ Memory Bed',
    },
  ];

  return (
    <section style={{ background: C.grayLight, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1210, margin: '0 auto' }}>
        <SectionTitle sub="Verified reviews from pet parents across the United States.">
          Happy Pets, Happier Owners
        </SectionTitle>
        <div
          className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          onScroll={handleScroll}
        >
          {reviews.map((r, i) => (
            <div key={i}
              className="min-w-[85vw] sm:min-w-0 snap-center"
              style={{
                padding: '36px 36px 32px',
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                display: 'flex', flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}>
              {/* Top accent */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: r.color,
              }} />

              {/* Stars */}
              <div style={{
                color: '#f59e0b', fontSize: 15,
                letterSpacing: '2px', marginBottom: 20,
              }}>
                ★★★★★
              </div>

              {/* Heading */}
              <h4 style={{
                fontFamily: F.heading, fontSize: 16, fontWeight: 700,
                color: C.primary, margin: '0 0 12px', lineHeight: 1.3,
              }}>
                {r.heading}
              </h4>

              {/* Quote */}
              <p style={{
                fontFamily: F.body, fontSize: 15, color: C.grayText,
                lineHeight: 1.8, margin: '0 0 auto', flexGrow: 1,
                fontStyle: 'italic', paddingBottom: 24,
              }}>
                &ldquo;{r.quote}&rdquo;
              </p>

              {/* Divider */}
              <div style={{ height: 1, background: C.border, marginBottom: 20 }} />

              {/* Author row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: r.color + '20',
                  border: `2px solid ${r.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: F.nav, fontSize: 12, fontWeight: 800,
                  color: r.color, flexShrink: 0,
                }}>
                  {r.initials}
                </div>
                <div>
                  <div style={{
                    fontFamily: F.nav, fontSize: 12, fontWeight: 800,
                    color: C.primary, letterSpacing: '0.08em',
                  }}>
                    {r.author}
                  </div>
                  <div style={{
                    fontFamily: F.body, fontSize: 12, color: C.grayText,
                    marginTop: 2,
                  }}>
                    {r.location}
                  </div>
                </div>
                {/* Verified badge */}
                <div style={{
                  marginLeft: 'auto',
                  fontFamily: F.nav, fontSize: 11, fontWeight: 800,
                  color: '#38c68b', letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span>✓</span> Verified
                </div>
              </div>

              {/* Product tag */}
              <div style={{
                marginTop: 16,
                fontFamily: F.nav, fontSize: 11, fontWeight: 700,
                color: C.grayText, letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Purchased: {r.product}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Pagination Dots */}
        <div className="flex sm:hidden justify-center gap-2 mt-8">
          {reviews.map((_, idx) => (
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

        {/* Trust bar */}
        <div className="grid grid-cols-2 lg:flex items-center justify-center gap-y-8 gap-x-4 mt-12 p-6 sm:p-8 bg-white border border-[#e2e5e8] rounded-lg">
          {[
            { label: '10,000+ Reviews', icon: '⭐' },
            { label: 'Verified Buyers Only', icon: '✅' },
            { label: 'US-Based Customers', icon: '🇺🇸' },
            { label: 'No Fake Reviews Policy', icon: '🛡️' },
          ].map(t => (
            <div key={t.label} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 8,
              fontFamily: F.nav,
              fontSize: 10,
              fontWeight: 800,
              color: C.grayText,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ lineHeight: 1.4 }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   INSIGHTS
 ───────────────────────────────────────────────────────────────── */
function PostCard({ post }: { post: BlogPost }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href="#"
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
          <img
            src={post.img}
            alt={post.title}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
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
        color: C.secondary,
        background: C.secondaryLight,
        border: `1px solid rgba(223,132,72,0.2)`,
        padding: '3px 10px', borderRadius: 2,
        letterSpacing: '0.12em', marginBottom: 12,
        textTransform: 'uppercase',
      }}>
        {post.cat}
      </div>

      <h4 style={{
        fontFamily: F.heading, fontSize: 16, fontWeight: 700,
        color: isHovered ? C.secondary : C.primary,
        lineHeight: 1.5, margin: '0 0 10px',
        transition: 'color 0.25s ease',
      }}>
        {post.title}
      </h4>

      <p style={{ fontSize: 15, color: C.grayText, margin: '0 0 12px', lineHeight: 1.6 }}>
        {post.excerpt}
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: F.nav, fontSize: 11, fontWeight: 700,
        color: isHovered ? C.secondary : C.grayText,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        transition: 'color 0.25s ease',
      }}>
        <span>{post.date}</span>
        <span>·</span>
        <span>{post.readTime}</span>
      </div>
    </Link>
  );
}

function Insights() {
  const [activeSlide, setActiveSlide] = useState(0);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const index = Math.round(el.scrollLeft / (el.clientWidth * 0.85));
    if (index !== activeSlide) setActiveSlide(index);
  };

  const posts = [
    {
      cat: 'Pet Health',
      title: 'Why Does My Pug Reverse Sneeze After Eating? (And 5 Easy Fixes)',
      excerpt: 'If your flat-faced dog makes that alarming honking sound after meals, here\'s why it happens and what ergonomics can do about it.',
      date: 'Nov 6, 2025',
      readTime: '5 min read',
      img: '/assets/Pug-Dog-Bed.jpg',
    },
    {
      cat: 'Buyer\'s Guide',
      title: 'Ergonomic Mealtime: What Every Flat-Faced Breed Owner Needs to Know',
      excerpt: 'A complete guide to choosing the right bowl height, angle, and material for brachycephalic dogs.',
      date: 'Oct 13, 2025',
      readTime: '7 min read',
      img: null,
    },
    {
      cat: 'Product Spotlight',
      title: 'Top 5 Gear Solutions for Senior Corgis Living Their Best Life',
      excerpt: 'Aging Corgis face unique challenges. These five ergonomic products made the biggest difference for our community.',
      date: 'Nov 19, 2025',
      readTime: '4 min read',
      img: null,
    },
  ];

  return (
    <section style={{ background: C.white, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle sub="Expert guides, breed-specific tips, and health insights for pet parents.">
          From the PetPosture Blog
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
   EMAIL CTA
 ───────────────────────────────────────────────────────────────── */
function EmailCta() {
  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section style={{ background: C.secondaryLight, padding: '40px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>

        {/* Eyebrow */}
        <div style={{
          fontFamily: F.nav, fontSize: 12, fontWeight: 800,
          color: C.secondary, letterSpacing: '0.2em',
          textTransform: 'uppercase', marginBottom: 20,
        }}>
          Join the Pack
        </div>

        <h2 style={{
          fontFamily: F.heading,
          fontSize: 'clamp(30px, 5vw, 46px)',
          fontWeight: 700, color: C.primary,
          textTransform: 'uppercase',
          letterSpacing: '-0.01em', lineHeight: 1.1,
          margin: '0 0 20px',
        }}>
          Get 10% Off Your<br />First Order
        </h2>

        <p style={{
          color: C.grayText, fontSize: 15, lineHeight: 1.7,
          margin: '0 auto 40px', maxWidth: 460,
        }}>
          Subscribe for breed-specific tips, early product launches, and exclusive
          member-only discounts — delivered to your inbox.
        </p>

        {!submitted ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-2 sm:gap-0 bg-white rounded-[4px] p-1 sm:p-[4px] transition-all duration-300"
            style={{
              maxWidth: 500, margin: '0 auto',
              boxShadow: isFocused
                ? '0 10px 32px -4px rgba(223,132,72,0.2)'
                : '0 4px 16px rgba(0,0,0,0.06)',
              border: `1px solid ${isFocused ? C.secondary : C.border}`,
            }}
          >
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required
              style={{
                flex: 1, border: 'none', outline: 'none',
                padding: '16px 20px',
                fontFamily: F.body, fontSize: 15,
                color: C.primary, background: 'transparent',
              }}
            />
            <button
              type="submit"
              className="px-8 py-4 sm:py-0 rounded-[2px] font-bold uppercase tracking-[0.12em] text-[15px] whitespace-nowrap transition-colors"
              style={{
                background: C.secondary, color: C.white,
                fontFamily: F.nav,
                cursor: 'pointer',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = C.secondaryHover}
              onMouseOut={(e) => e.currentTarget.style.background = C.secondary}
            >
              Get 10% Off
            </button>
          </form>
        ) : (
          <div style={{
            maxWidth: 500, margin: '0 auto',
            padding: '24px 32px',
            background: C.white,
            border: `1px solid #38c68b40`,
            borderRadius: 4,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <p style={{
              fontFamily: F.heading, fontSize: 16, fontWeight: 700,
              color: C.primary, margin: '0 0 6px',
            }}>
              You&apos;re in! Check your inbox.
            </p>
            <p style={{ fontSize: 15, color: C.grayText, margin: 0 }}>
              Your 10% discount code is on its way.
            </p>
          </div>
        )}

        {/* Trust micro-copy */}
        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-8 sm:mt-6 opacity-80 uppercase tracking-[0.08em] font-bold text-[11px] sm:text-[11px]" style={{ fontFamily: F.nav, color: C.grayText }}>
          {['🔒 No spam, ever', '✉️ Unsubscribe anytime', '🐾 Pet-exclusive offers'].map(t => (
            <span key={t} className="flex items-center whitespace-nowrap">{t}</span>
          ))}
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
        <Testimonials />
        <Insights />
        <EmailCta />
      </main>
      <Footer />
    </div>
  );
}
