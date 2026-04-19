"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useShopLogic } from '@/hooks/useShopLogic';
import { ProductFilterBar } from '@/components/shop/ProductFilterBar';
import { ProductGrid } from '@/components/shop/ProductGrid';

export default function ShopPage() {
    const shopLogic = useShopLogic();

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            {/* Hero Section */}
            <section className="bg-[#f8f9fa] pt-20 pb-16 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-[13px] font-bold text-[#df8448] uppercase tracking-[0.4em] mb-4">
                            PetPosture Elite Gear
                        </h1>
                        <h2 className="text-[36px] md:text-[52px] font-bold text-[#3e4c57] leading-tight mb-6">
                            THE ERGONOMIC SHOP
                        </h2>
                        <div className="w-12 h-1 bg-[#df8448] mx-auto rounded-full mb-6"></div>
                        <p className="max-w-[600px] mx-auto text-zinc-500 text-[16px] leading-relaxed">
                            Every product in our shop is engineered in collaboration with veterinary experts to ensure your pet's long-term health and comfort.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Filter Bar */}
            <ProductFilterBar
                categories={shopLogic.categories}
                activeCategory={shopLogic.activeCategory}
                setActiveCategory={shopLogic.setActiveCategory}
                searchQuery={shopLogic.searchQuery}
                setSearchQuery={shopLogic.setSearchQuery}
                sortBy={shopLogic.sortBy}
                setSortBy={shopLogic.setSortBy}
            />

            {/* Product Grid */}
            {shopLogic.isLoading ? (
                <div className="py-24 text-center">
                    <div className="w-12 h-12 border-4 border-[#df8448] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-500 font-medium">Loading ergonomic gear...</p>
                </div>
            ) : (
                <ProductGrid
                    filteredProducts={shopLogic.filteredProducts}
                    searchQuery={shopLogic.searchQuery}
                    setSearchQuery={shopLogic.setSearchQuery}
                />
            )}

            {/* Newsletter */}
            <section className="bg-zinc-50 py-24 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto">
                    <div className="bg-[#3e4c57] rounded-[40px] p-8 md:p-16 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="relative z-10 text-center md:text-left max-w-xl">
                            <h2 className="text-white text-[32px] md:text-[44px] font-bold leading-tight mb-6">
                                GET THE SCIENCE OF <br /> <span className="text-[#df8448]">ERGO-CARE</span>
                            </h2>
                            <p className="text-white/60 text-[16px] leading-relaxed">
                                Join 10,000+ pet parents receiving monthly ergonomic tips and exclusive early access to our newest gear.
                            </p>
                        </div>

                        <div className="relative z-10 w-full md:w-auto">
                            <div className="flex bg-white p-2 rounded-[6px] shadow-2xl">
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="flex-1 px-6 py-4 text-[14px] outline-none text-[#3e4c57] md:w-64"
                                />
                                <button className="bg-[#df8448] text-white px-8 py-4 rounded-[4px] font-black text-[11px] uppercase tracking-widest hover:bg-[#c9713a] transition-all">
                                    Subscribe
                                </button>
                            </div>
                        </div>

                        {/* Background elements */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#df8448]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32 blur-2xl" />
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
