"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/types/shop';
import { ProductCard } from '@/components/shop/ProductCard';

interface RelatedProductsProps {
    products: Product[];
    currentProductId: number;
}

export function RelatedProducts({ products, currentProductId }: RelatedProductsProps) {
    // Filter out current product and take top 4
    const related = products
        .filter(p => p.id !== currentProductId)
        .slice(0, 4);

    if (related.length === 0) return null;

    return (
        <section className="py-24 px-4 md:px-8 bg-white overflow-hidden">
            <div className="max-w-[1200px] mx-auto">
                <div className="flex items-end justify-between mb-12">
                    <div>
                        <h2 className="text-[#df8448] text-[12px] font-black uppercase tracking-[0.4em] mb-4">Complete the solution</h2>
                        <h3 className="text-[#3e4c57] text-[32px] md:text-[44px] font-bold leading-tight uppercase">RELATED GEAR</h3>
                    </div>
                    <div className="w-12 h-1 bg-[#df8448] rounded-full hidden md:block"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {related.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <ProductCard product={product} />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
