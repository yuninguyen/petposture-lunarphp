import React from 'react';
import { Search, X } from 'lucide-react';
import { Product } from '@/types/shop';
import { ProductCard } from '@/components/shop/ProductCard';

interface ProductGridProps {
    filteredProducts: Product[];
    clearFilters: () => void;
    loading?: boolean;
}

function SkeletonCard() {
    return (
        <div className="animate-pulse rounded-[20px] border border-[#f0e8e0] bg-white p-4">
            <div className="mb-3 h-[180px] rounded-[14px] bg-[#f3ece5]" />
            <div className="mb-2 h-4 w-3/4 rounded bg-[#f0e8e0]" />
            <div className="h-4 w-1/2 rounded bg-[#f0e8e0]" />
        </div>
    );
}

export function ProductGrid({ filteredProducts, clearFilters, loading = false }: ProductGridProps) {
    return (
        <>
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
                    <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-7 text-[#7a7f83]">
                        Try clearing the current search or switching to another category from the sidebar.
                    </p>
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 rounded-full bg-[#f7efe8] px-4 py-2 text-sm font-bold capitalize text-[#c06f3d] transition hover:bg-[#f2e3d7]"
                    >
                        Clear Filters <X size={14} />
                    </button>
                </div>
            )}
        </>
    );
}
