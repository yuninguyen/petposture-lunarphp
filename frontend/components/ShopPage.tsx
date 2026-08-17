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
    initialSearch?: string;
    allBreeds?: { slug: string; label: string }[];
    allSolutions?: { slug: string; label: string }[];
    heroEyebrow?: string;
    heroTitle?: string;
    heroDescription?: string;
}

export default function ShopPage({
    initialProducts,
    initialBreed = 'All',
    initialSolution = 'All',
    initialSearch = '',
    allBreeds = [],
    allSolutions = [],
    heroEyebrow = 'PetPosture Shop',
    heroTitle = 'Ergonomic essentials, organized like a real catalog.',
    heroDescription = "Shop ergonomic bowls, ramps, beds, and harnesses — engineered for your pet's posture and comfort.",
}: ShopPageProps) {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const shopLogic = useShopLogic(initialProducts, initialBreed, initialSolution, initialSearch, allBreeds, allSolutions);
    const activeBreedLabel = shopLogic.breeds.find((b) => b.slug === shopLogic.activeBreed)?.label;
    const activeSolutionLabel = shopLogic.solutions.find((s) => s.slug === shopLogic.activeSolution)?.label;
    const activeCategoryLabel = shopLogic.categories.find((c) => c.slug === shopLogic.activeCategory)?.name;
    const activeFilterLabel = [
        shopLogic.activeCategory !== 'All' ? activeCategoryLabel : null,
        shopLogic.activeBreed !== 'All' ? activeBreedLabel : null,
        shopLogic.activeSolution !== 'All' ? activeSolutionLabel : null,
    ].filter(Boolean).join(' + ');

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            <section className="px-4 pb-6 pt-6 md:px-8 md:pb-8 md:pt-8">
                <div className="mx-auto max-w-[1280px]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-rust">
                                {heroEyebrow}
                            </p>
                            <h1 className="max-w-[640px] text-[22px] font-bold leading-tight text-[#2d3a43] md:text-[28px]">
                                {heroTitle}
                            </h1>
                            <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#62666a]">
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

            <section className="px-4 pb-10 md:px-8">
                <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
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
                        <div className="mb-6 flex flex-col gap-3 border-b border-[#e7ddd2] pb-4 md:flex-row md:items-center md:justify-between">
                            <p className="text-sm text-[#6a6f73]">
                                Showing <span className="font-semibold text-[#2d3a43]">{shopLogic.filteredProducts.length}</span> of{' '}
                                <span className="font-semibold text-[#2d3a43]">{shopLogic.totalProducts}</span> products
                                {activeFilterLabel ? ` · Filtered to ${activeFilterLabel}` : ''}
                            </p>

                            {(shopLogic.activeCategory !== 'All' || shopLogic.activeBreed !== 'All' || shopLogic.activeSolution !== 'All' || shopLogic.searchQuery) && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {shopLogic.activeCategory !== 'All' && (
                                        <span className="rounded-full bg-[#f7efe8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                            {activeCategoryLabel || shopLogic.activeCategory}
                                        </span>
                                    )}
                                    {shopLogic.activeBreed !== 'All' && (
                                        <span className="rounded-full bg-[#f7efe8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                            {activeBreedLabel || shopLogic.activeBreed}
                                        </span>
                                    )}
                                    {shopLogic.activeSolution !== 'All' && (
                                        <span className="rounded-full bg-[#f7efe8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#b36a3b]">
                                            {activeSolutionLabel || shopLogic.activeSolution}
                                        </span>
                                    )}
                                    {shopLogic.searchQuery && (
                                        <span className="rounded-full bg-[#eef3f5] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#54646e]">
                                            Search: {shopLogic.searchQuery}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <ProductGrid
                            filteredProducts={shopLogic.filteredProducts}
                            clearFilters={shopLogic.clearFilters}
                            loading={shopLogic.loading}
                        />
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
