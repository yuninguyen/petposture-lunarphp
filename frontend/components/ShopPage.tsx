"use client";

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useShopLogic } from '@/hooks/useShopLogic';
import { ProductFilterBar } from '@/components/shop/ProductFilterBar';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { Product } from '@/types/shop';

interface ShopPageProps {
    initialProducts: Product[];
}

export default function ShopPage({ initialProducts }: ShopPageProps) {
    const shopLogic = useShopLogic(initialProducts);

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-[#df8448]">
                                PetPosture Shop
                            </p>
                            <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                                Ergonomic essentials, organized like a real catalog.
                            </h1>
                            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                                Products now load upfront, and the page is trimmed down so filters and items show sooner without a bulky hero getting in the way.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 self-start rounded-full border border-[#e3d6c9] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b8f93] shadow-sm">
                            <SlidersHorizontal size={14} className="text-[#df8448]" />
                            Left sidebar filters
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
                    <ProductFilterBar
                        categories={shopLogic.categories}
                        activeCategory={shopLogic.activeCategory}
                        setActiveCategory={shopLogic.setActiveCategory}
                        searchQuery={shopLogic.searchQuery}
                        setSearchQuery={shopLogic.setSearchQuery}
                        sortBy={shopLogic.sortBy}
                        setSortBy={shopLogic.setSortBy}
                        clearFilters={shopLogic.clearFilters}
                        hasActiveFilters={shopLogic.hasActiveFilters}
                    />

                    <div className="min-w-0">
                        <div className="mb-5 flex flex-col gap-3 rounded-[24px] border border-[#eadfd3] bg-white px-5 py-4 shadow-[0_18px_50px_rgba(34,33,33,0.05)] md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b8f93]">
                                    <SlidersHorizontal size={14} className="text-[#df8448]" />
                                    Storefront overview
                                </div>
                                <h2 className="mt-2 text-[21px] font-semibold text-[#2d3a43]">
                                    Showing {shopLogic.filteredProducts.length} of {shopLogic.totalProducts} products
                                </h2>
                                <p className="mt-1 text-[13px] text-[#6a6f73]">
                                    {shopLogic.activeCategory === 'All'
                                        ? 'Browse the full catalog or narrow it down from the left sidebar.'
                                        : `Filtered to ${shopLogic.activeCategory}.`}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {shopLogic.activeCategory !== 'All' && (
                                    <span className="rounded-full bg-[#f7efe8] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b36a3b]">
                                        {shopLogic.activeCategory}
                                    </span>
                                )}
                                {shopLogic.searchQuery && (
                                    <span className="rounded-full bg-[#eef3f5] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#54646e]">
                                        Search: {shopLogic.searchQuery}
                                    </span>
                                )}
                            </div>
                        </div>

                        <ProductGrid
                            filteredProducts={shopLogic.filteredProducts}
                            totalProducts={shopLogic.totalProducts}
                            activeCategory={shopLogic.activeCategory}
                            searchQuery={shopLogic.searchQuery}
                            clearFilters={shopLogic.clearFilters}
                            loading={shopLogic.loading}
                        />
                    </div>
                </div>
            </section>

            <section className="bg-[#ede5db] px-4 py-20 md:px-8">
                <div className="mx-auto max-w-[1000px]">
                    <div className="relative overflow-hidden rounded-2xl bg-[#3e4c57] p-8 text-center shadow-xl md:p-14">
                        <div className="relative z-10">
                            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.34em] text-[#df8448]">
                                PetPosture Dispatch
                            </p>
                            <h2 className="mb-4 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
                                Get new product drops and posture-focused picks before everyone else.
                            </h2>
                            <p className="mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-white/70 md:text-[16px]">
                                A tighter catalog deserves a tighter email list. We send launches, restocks, and practical buying guidance.
                            </p>
                            <div className="mx-auto flex max-w-xl flex-col gap-3 md:flex-row">
                                <input
                                    type="email"
                                    placeholder="Enter your email address"
                                    className="w-full md:flex-1 rounded-[3px] bg-white px-6 py-4 text-[14px] font-medium text-[#3e4c57] outline-none"
                                />
                                <button className="w-full md:w-auto whitespace-nowrap rounded-[3px] bg-[#df8448] px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-[#c9713a]">
                                    Subscribe Now
                                </button>
                            </div>
                            <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-white/30">
                                By subscribing, you agree to our privacy policy and terms.
                            </p>
                        </div>
                        <div className="absolute left-0 top-0 -ml-24 -mt-24 h-48 w-48 rounded-full bg-[#df8448]/10 blur-[80px]" />
                        <div className="absolute bottom-0 right-0 -mb-24 -mr-24 h-48 w-48 rounded-full bg-white/5 blur-[80px]" />
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
