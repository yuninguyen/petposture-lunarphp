import React from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { SORT_OPTIONS } from '@/lib/shopData';

interface ProductFilterBarProps {
    categories: string[];
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
}

export function ProductFilterBar({
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy
}: ProductFilterBarProps) {
    return (
        <section className="bg-white border-b border-zinc-100 py-4 px-4 md:px-8 shadow-sm relative z-10 transition-shadow">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Categories - Scrollable on mobile */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                  px-5 py-2 rounded-[3px] text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeCategory === cat
                                    ? 'bg-[#3e4c57] text-white shadow-lg shadow-zinc-200'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}
                `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Search & Sort */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Find products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#f8f9fa] border-none rounded-[3px] pl-10 pr-4 py-2.5 text-[13px] outline-none focus:ring-1 focus:ring-[#df8448]/30"
                        />
                    </div>

                    <div className="relative group">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="appearance-none bg-[#f8f9fa] border-none rounded-[3px] pl-4 pr-10 py-2.5 text-[11px] font-bold uppercase tracking-widest outline-none cursor-pointer focus:ring-1 focus:ring-[#df8448]/30"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </section>
    );
}
