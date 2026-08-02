import React from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { SORT_OPTIONS } from '@/lib/shopData';
import { ShopCategoryOption, ShopBreedOption, ShopSolutionOption } from '@/hooks/useShopLogic';

interface ProductFilterBarProps {
    categories: ShopCategoryOption[];
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    breeds: ShopBreedOption[];
    activeBreed: string;
    setActiveBreed: (breed: string) => void;
    solutions: ShopSolutionOption[];
    activeSolution: string;
    setActiveSolution: (solution: string) => void;
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
    breeds,
    activeBreed,
    setActiveBreed,
    solutions,
    activeSolution,
    setActiveSolution,
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
                    <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#9a806a]">Refine Catalog</p>
                    <h2 className="mt-2 text-[24px] font-semibold text-[#2d3a43]">Filters</h2>
                </div>

                <div className="space-y-7 px-6 py-6">
                    <div>
                        <label className="mb-2 block text-sm font-bold uppercase tracking-[0.22em] text-[#8b8f93]">
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
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[#8b8f93]">Category</p>
                        <div className="space-y-2">
                            {categories.map((category) => (
                                <button
                                    key={category.name}
                                    onClick={() => setActiveCategory(category.name)}
                                    className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${activeCategory === category.name
                                        ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                        : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                        }`}
                                >
                                    <span className="font-medium">{category.name}</span>
                                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#8b8f93]">
                                        {category.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {breeds.length > 0 && (
                        <div>
                            <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[#8b8f93]">Breed Type</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActiveBreed('All')}
                                    className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${activeBreed === 'All'
                                        ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                        : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                        }`}
                                >
                                    <span className="font-medium">All Breeds</span>
                                </button>
                                {breeds.map((breed) => (
                                    <button
                                        key={breed.slug}
                                        onClick={() => setActiveBreed(breed.slug)}
                                        className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${activeBreed === breed.slug
                                            ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                            : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                            }`}
                                    >
                                        <span className="font-medium">{breed.label}</span>
                                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#8b8f93]">
                                            {breed.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {solutions.length > 0 && (
                        <div>
                            <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[#8b8f93]">Solution</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActiveSolution('All')}
                                    className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${activeSolution === 'All'
                                        ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                        : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                        }`}
                                >
                                    <span className="font-medium">All Solutions</span>
                                </button>
                                {solutions.map((solution) => (
                                    <button
                                        key={solution.slug}
                                        onClick={() => setActiveSolution(solution.slug)}
                                        className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${activeSolution === solution.slug
                                            ? 'border-[#df8448] bg-[#fff3eb] text-[#2d3a43] shadow-[0_12px_24px_rgba(223,132,72,0.12)]'
                                            : 'border-[#efe5dc] bg-white text-[#687076] hover:border-[#d9c6b5] hover:bg-[#faf7f3]'
                                            }`}
                                    >
                                        <span className="font-medium">{solution.label}</span>
                                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#8b8f93]">
                                            {solution.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-sm font-bold uppercase tracking-[0.22em] text-[#8b8f93]">
                            Sort By
                        </label>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="h-[50px] w-full appearance-none rounded-[16px] border border-[#e7ddd2] bg-[#faf7f3] pl-4 pr-12 text-sm font-semibold text-[#2d3a43] outline-none transition focus:border-[#df8448] focus:bg-white"
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8b8f93]" />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="h-[48px] w-full rounded-[16px] border border-[#d9c6b5] text-sm font-bold uppercase tracking-[0.22em] text-[#7d5f49] transition hover:border-[#df8448] hover:text-[#df8448]"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
