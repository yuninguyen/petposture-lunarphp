import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { Product } from '@/types/shop';
import { ProductCard } from '@/components/shop/ProductCard';

interface ProductGridProps {
    filteredProducts: Product[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export function ProductGrid({ filteredProducts, searchQuery, setSearchQuery }: ProductGridProps) {
    return (
        <section className="py-16 md:py-24 px-4 md:px-8">
            <div className="max-w-[1200px] mx-auto">

                <div className="flex items-center justify-between mb-12">
                    <p className="text-zinc-400 text-[13px] font-medium">
                        Showing <span className="text-[#3e4c57] font-bold">{filteredProducts.length}</span> results
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="flex items-center gap-2 text-[11px] font-bold text-[#df8448] uppercase tracking-widest"
                        >
                            Clear Search <X size={14} />
                        </button>
                    )}
                </div>

                <AnimatePresence mode="popLayout">
                    {filteredProducts.length > 0 ? (
                        <motion.div
                            layout
                            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12"
                        >
                            {filteredProducts.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center"
                        >
                            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Search size={32} className="text-zinc-200" />
                            </div>
                            <h3 className="text-[20px] font-bold text-[#3e4c57] mb-2">No results found</h3>
                            <p className="text-zinc-400">Try adjusting your filters or search keywords.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
