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
                        />
                    </div>
                </div>
            </section>

            <section className="bg-[#ede5db] px-4 py-20 md:px-8">
                <div className="mx-auto max-w-[1280px]">
                    <div className="relative overflow-hidden rounded-[36px] border border-[#e3d6c9] bg-[#2f3d46] px-8 py-10 shadow-[0_30px_90px_rgba(24,27,29,0.20)] md:px-12 md:py-14">
                        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#df8448]/15 blur-2xl" />
                        <div className="absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
                        <div className="relative z-10 flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
                            <div className="max-w-xl">
                                <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.34em] text-[#df8448]">PetPosture Dispatch</p>
                                <h2 className="text-[30px] font-bold leading-tight text-white md:text-[42px]">
                                    Get new product drops and posture-focused picks before everyone else.
                                </h2>
                                <p className="mt-4 text-[15px] leading-7 text-white/72">
                                    A tighter catalog deserves a tighter email list. We send launches, restocks, and practical buying guidance.
                                </p>
                            </div>

                            <div className="w-full max-w-[430px] rounded-[22px] bg-white p-3 shadow-2xl">
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="email"
                                        placeholder="Enter your email"
                                        className="h-[54px] flex-1 rounded-[16px] border border-[#e6dfd8] px-5 text-[14px] text-[#2d3a43] outline-none transition focus:border-[#df8448]"
                                    />
                                    <button className="h-[54px] rounded-[16px] bg-[#df8448] px-7 text-[11px] font-bold uppercase tracking-[0.22em] text-white transition hover:bg-[#c9713a]">
                                        Subscribe
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
