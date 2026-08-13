"use client";

import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useShopLogic } from '@/hooks/useShopLogic';
import { ProductFilterBar } from '@/components/shop/ProductFilterBar';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { Product } from '@/types/shop';

interface ShopPageProps {
    initialProducts: Product[];
    initialBreed?: string;
    initialSolution?: string;
    heroEyebrow?: string;
    heroTitle?: string;
    heroDescription?: string;
}

export default function ShopPage({
    initialProducts,
    initialBreed = 'All',
    initialSolution = 'All',
    heroEyebrow = 'PetPosture Shop',
    heroTitle = 'Ergonomic essentials, organized like a real catalog.',
    heroDescription = "Shop ergonomic bowls, ramps, beds, and harnesses — engineered for your pet's posture and comfort.",
}: ShopPageProps) {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const shopLogic = useShopLogic(initialProducts, initialBreed, initialSolution);
    const activeBreedLabel = shopLogic.breeds.find((b) => b.slug === shopLogic.activeBreed)?.label;
    const activeSolutionLabel = shopLogic.solutions.find((s) => s.slug === shopLogic.activeSolution)?.label;
    const activeCategoryLabel = shopLogic.categories.find((c) => c.slug === shopLogic.activeCategory)?.name;
    const activeFilterLabel = [
        shopLogic.activeCategory !== 'All' ? activeCategoryLabel : null,
        shopLogic.activeBreed !== 'All' ? activeBreedLabel : null,
        shopLogic.activeSolution !== 'All' ? activeSolutionLabel : null,
    ].filter(Boolean).join(' + ');

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rust">
                                {heroEyebrow}
                            </p>
                            <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                                {heroTitle}
                            </h1>
                            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                                {heroDescription}
                            </p>
                        </div>

                        <button
                            key={mobileFiltersOpen ? 'open' : 'closed'}
                            type="button"
                            onClick={() => setMobileFiltersOpen((open) => !open)}
                            aria-expanded={mobileFiltersOpen}
                            className="flex items-center gap-2 self-start rounded-full border border-[#e3d6c9] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#8b8f93] shadow-sm transition-colors hover:border-secondary hover:text-rust lg:hidden [transform:translateZ(0)]"
                        >
                            <SlidersHorizontal size={14} className="text-rust" />
                            {mobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
                            {shopLogic.hasActiveFilters && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                            )}
                            {mobileFiltersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>
            </section>

            <section className="px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
                    <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
                        <ProductFilterBar
                            categories={shopLogic.categories}
                            activeCategory={shopLogic.activeCategory}
                            setActiveCategory={shopLogic.setActiveCategory}
                            breeds={initialBreed === 'All' ? shopLogic.breeds : []}
                            activeBreed={shopLogic.activeBreed}
                            setActiveBreed={shopLogic.setActiveBreed}
                            solutions={initialSolution === 'All' ? shopLogic.solutions : []}
                            activeSolution={shopLogic.activeSolution}
                            setActiveSolution={shopLogic.setActiveSolution}
                            searchQuery={shopLogic.searchQuery}
                            setSearchQuery={shopLogic.setSearchQuery}
                            sortBy={shopLogic.sortBy}
                            setSortBy={shopLogic.setSortBy}
                            clearFilters={shopLogic.clearFilters}
                            hasActiveFilters={shopLogic.hasActiveFilters}
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="mb-5 flex flex-col gap-3 rounded-[24px] border border-[#eadfd3] bg-white px-5 py-4 shadow-[0_18px_50px_rgba(34,33,33,0.05)] md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-[#8b8f93]">
                                    <SlidersHorizontal size={14} className="text-rust" />
                                    Storefront overview
                                </div>
                                <h2 className="mt-2 text-[21px] font-semibold text-[#2d3a43]">
                                    Showing {shopLogic.filteredProducts.length} of {shopLogic.totalProducts} products
                                </h2>
                                <p className="mt-1 text-sm text-[#6a6f73]">
                                    {activeFilterLabel
                                        ? `Filtered to ${activeFilterLabel}.`
                                        : 'Browse the full catalog or narrow it down from the left sidebar.'}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {shopLogic.activeCategory !== 'All' && (
                                    <span className="rounded-full bg-[#f7efe8] px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                        {activeCategoryLabel || shopLogic.activeCategory}
                                    </span>
                                )}
                                {shopLogic.activeBreed !== 'All' && (
                                    <span className="rounded-full bg-[#f7efe8] px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                        {activeBreedLabel || shopLogic.activeBreed}
                                    </span>
                                )}
                                {shopLogic.activeSolution !== 'All' && (
                                    <span className="rounded-full bg-[#f7efe8] px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                        {activeSolutionLabel || shopLogic.activeSolution}
                                    </span>
                                )}
                                {shopLogic.searchQuery && (
                                    <span className="rounded-full bg-[#eef3f5] px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#54646e]">
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
                    <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-center shadow-xl md:p-14">
                        <div className="relative z-10">
                            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-rust">
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
                                    className="w-full md:flex-1 rounded-[3px] bg-white px-6 py-4 text-[14px] font-medium text-primary outline-none"
                                />
                                <button className="w-full md:w-auto whitespace-nowrap rounded-[3px] bg-secondary px-10 py-4 text-sm font-bold uppercase tracking-[0.12em] text-ink shadow-lg transition-all hover:bg-secondary-dark">
                                    Subscribe Now
                                </button>
                            </div>
                            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/30">
                                By subscribing, you agree to our privacy policy and terms.
                            </p>
                        </div>
                        <div className="absolute left-0 top-0 -ml-24 -mt-24 h-48 w-48 rounded-full bg-secondary/10 blur-[80px]" />
                        <div className="absolute bottom-0 right-0 -mb-24 -mr-24 h-48 w-48 rounded-full bg-white/5 blur-[80px]" />
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
