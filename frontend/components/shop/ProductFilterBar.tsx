import React from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { SORT_OPTIONS } from '@/lib/shopData';
import { ShopCategoryOption } from '@/hooks/useShopLogic';

interface ProductFilterBarProps {
    categories: ShopCategoryOption[];
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
}

export function ProductFilterBar({
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    clearFilters,
    hasActiveFilters,
}: ProductFilterBarProps) {
    return (
        <aside className="lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-[28px] border border-[#eadfd3] bg-white shadow-[0_18px_50px_rgba(34,33,33,0.05)]">
                <div className="border-b border-[#f0e7de] px-6 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#9a806a]">Refine Catalog</p>
                    <h2 className="mt-2 text-[24px] font-semibold text-[#2d3a43]">Filters</h2>
                </div>

                <div className="space-y-7 px-6 py-6">
                    <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#8b8f93]">
                            Search
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b8f93]" />
                            <input
                                type="text"
                                placeholder="Find products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-[50px] w-full rounded-[16px] border border-[#e7ddd2] bg-[#faf7f3] pl-11 pr-4 text-[14px] outline-none transition focus:border-[#df8448] focus:bg-white"
                            />
                        </div>
                    </div>

                    <div>
                        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8b8f93]">Category</p>
                        <div className="space-y-2">
                            {categories.map((category) => (
                                <button
                                    key={category.name}
                                    onClick={() => setActiveCategory(category.name)}
                                    className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-[13px] transition ${activeCategory === category.name
                                        ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                        : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                        }`}
                                >
                                    <span className="font-medium">{category.name}</span>
                                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#8b8f93]">
                                        {category.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#8b8f93]">
                            Sort By
                        </label>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="h-[50px] w-full appearance-none rounded-[16px] border border-[#e7ddd2] bg-[#faf7f3] pl-4 pr-12 text-[13px] font-semibold text-[#2d3a43] outline-none transition focus:border-[#df8448] focus:bg-white"
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8b8f93]" />
                        </div>
                    </div>

                    <div className="rounded-[20px] bg-[#2f3d46] p-5 text-white">
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#df8448]">Why this feels faster</p>
                        <p className="mt-3 text-[13px] leading-6 text-white/78">
                            Products are preloaded before the page paints, so the catalog no longer waits on an extra client fetch.
                        </p>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="h-[48px] w-full rounded-[16px] border border-[#d9c6b5] text-[11px] font-bold uppercase tracking-[0.22em] text-[#7d5f49] transition hover:border-[#df8448] hover:text-[#df8448]"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
