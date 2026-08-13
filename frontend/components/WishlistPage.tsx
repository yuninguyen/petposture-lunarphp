"use client";

import React from 'react';
import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { useWishlist } from '@/context/WishlistContext';

export default function WishlistPage() {
    const { items, loading } = useWishlist();

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                        My Wishlist
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        Products you&apos;re keeping an eye on.
                    </h1>
                </div>
            </section>

            <section className="px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <div className="rounded-[24px] border border-[#eadfd3] bg-white p-4 shadow-[0_18px_50px_rgba(34,33,33,0.05)] md:p-5">
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="animate-pulse rounded-[20px] border border-[#f0e8e0] bg-white p-4">
                                        <div className="mb-3 h-[180px] rounded-[14px] bg-[#f3ece5]" />
                                        <div className="mb-2 h-4 w-3/4 rounded bg-[#f0e8e0]" />
                                        <div className="h-4 w-1/2 rounded bg-[#f0e8e0]" />
                                    </div>
                                ))}
                            </div>
                        ) : items.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                {items.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#faf7f3]">
                                    <Heart size={32} className="text-[#c7b7a9]" />
                                </div>
                                <h3 className="mb-2 text-[22px] font-semibold text-[#2d3a43]">Your wishlist is empty</h3>
                                <p className="mx-auto mb-8 max-w-[420px] text-[14px] leading-7 text-[#7a7f83]">
                                    Tap the heart icon on any product to save it here for later.
                                </p>
                                <Link
                                    href="/shop"
                                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ink transition hover:bg-secondary-dark"
                                >
                                    Browse the Shop <ArrowRight size={14} />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
