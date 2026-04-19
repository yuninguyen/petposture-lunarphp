"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Product } from '@/types/shop';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ScientificBreakdown } from '@/components/product/ScientificBreakdown';
import { TrustBadgeBar } from '@/components/product/TrustBadgeBar';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { motion, AnimatePresence } from 'framer-motion';

export default function SingleProductPage() {
    const { id } = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProductData() {
            try {
                // 1. Fetch current product
                const res = await fetch(`http://localhost:8000/api/products/${id}`);
                if (!res.ok) throw new Error('Product not found');
                const { data } = await res.json();
                setProduct(data);

                // 2. Fetch all products to filter related
                const allRes = await fetch(`http://localhost:8000/api/products`);
                if (allRes.ok) {
                    const allData = await allRes.json();
                    setRelatedProducts(allData.data || []);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load product');
            } finally {
                setIsLoading(false);
            }
        }
        if (id) fetchProductData();
    }, [id]);

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key="loading"
                        className="min-h-[60vh] flex flex-col items-center justify-center"
                    >
                        <div className="w-12 h-12 border-4 border-[#df8448] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[11px]">Analyzing Bio-Data...</p>
                    </motion.div>
                ) : error || !product ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key="error"
                        className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center"
                    >
                        <h2 className="text-[24px] font-bold text-[#3e4c57] mb-4">Oops! Product Unavailable</h2>
                        <p className="text-zinc-400 mb-8 max-w-md">The specific ergonomic gear you're looking for might have been moved or is currently out of stock.</p>
                        <a href="/shop" className="bg-[#df8448] text-white px-8 py-4 rounded-[4px] font-black text-[11px] uppercase tracking-widest hover:bg-[#c9713a] transition-all focus:ring-2 focus:ring-[#df8448]/20 outline-none">
                            Back to Shop
                        </a>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        key="content"
                    >
                        <ProductDetails product={product} />
                        <TrustBadgeBar />
                        <ProductReviews product={product} />
                        <ScientificBreakdown product={product} />
                        <RelatedProducts
                            products={relatedProducts}
                            currentProductId={product.id}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <Footer />
        </main>
    );
}
