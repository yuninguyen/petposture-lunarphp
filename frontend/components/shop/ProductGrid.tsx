import React from 'react';
import { Search, X } from 'lucide-react';
import { Product } from '@/types/shop';
import { ProductCard } from '@/components/shop/ProductCard';

interface ProductGridProps {
    filteredProducts: Product[];
    totalProducts: number;
    activeCategory: string;
    searchQuery: string;
    clearFilters: () => void;
}

export function ProductGrid({ filteredProducts, totalProducts, activeCategory, searchQuery, clearFilters }: ProductGridProps) {
    return (
        <section className="rounded-[24px] border border-[#eadfd3] bg-white p-4 shadow-[0_18px_50px_rgba(34,33,33,0.05)] md:p-5">
            <div className="mb-6 flex flex-col gap-3 border-b border-[#f1e8df] pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8b8f93]">Catalog Results</p>
                    <p className="mt-2 text-[14px] text-[#62666a]">
                        Showing <span className="font-semibold text-[#2d3a43]">{filteredProducts.length}</span> matches
                        from <span className="font-semibold text-[#2d3a43]">{totalProducts}</span> total items.
                    </p>
                </div>

                {(searchQuery || activeCategory !== 'All') && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 self-start rounded-full bg-[#f7efe8] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c06f3d] transition hover:bg-[#f2e3d7]"
                    >
                        Clear Filters <X size={14} />
                    </button>
                )}
            </div>

            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.variantId} product={product} />
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#faf7f3]">
                        <Search size={32} className="text-[#c7b7a9]" />
                    </div>
                    <h3 className="mb-2 text-[22px] font-semibold text-[#2d3a43]">No products match these filters</h3>
                    <p className="mx-auto max-w-[420px] text-[14px] leading-7 text-[#7a7f83]">
                        Try clearing the current search or switching to another category from the sidebar.
                    </p>
                </div>
            )}
        </section>
    );
}
