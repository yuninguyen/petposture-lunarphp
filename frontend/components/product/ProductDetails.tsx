"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { Product } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import { Breadcrumbs } from './Breadcrumbs';

/* Hide scrollbars but keep functionality */
const scrollbarHideStyles = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

interface ProductDetailsProps {
    product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState('description');
    const { addItem } = useCart();

    const tabs = [
        { id: 'description', label: 'Detailed Description' },
        { id: 'specs', label: 'Technical Specs' },
        { id: 'shipping', label: 'Shipping & Returns' }
    ];

    return (
        <div className="bg-white">
            <Breadcrumbs category={product.category} productName={product.name} />

            <section className="pt-4 pb-24 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-start">

                    {/* Image Gallery */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative lg:sticky lg:top-24"
                    >
                        <div className="aspect-[4/5] bg-zinc-50 rounded-3xl overflow-hidden border border-zinc-100 shadow-2xl shadow-zinc-100/50">
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                            {product.badge && (
                                <span className="absolute top-8 left-8 bg-[#df8448] text-white text-[10px] font-black px-4 py-1.5 rounded-[2px] uppercase tracking-widest shadow-xl shadow-orange-500/20">
                                    {product.badge}
                                </span>
                            )}
                        </div>
                    </motion.div>

                    {/* Info Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col"
                    >
                        {/* Header Info */}
                        <div className="mb-8">
                            <p className="text-[#df8448] text-[12px] font-black uppercase tracking-[0.3em] mb-4">
                                {product.category} Ergonomics
                            </p>
                            <h1 className="text-[32px] md:text-[44px] font-bold text-[#3e4c57] leading-[1.1] mb-6">
                                {product.name}
                            </h1>

                            <div className="flex items-center gap-6 mb-8">
                                <div className="flex items-center gap-1.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={14}
                                            className={i < product.rating ? "text-[#df8448] fill-[#df8448]" : "text-zinc-200"}
                                        />
                                    ))}
                                    <span className="text-[12px] text-zinc-400 font-bold ml-1">({product.reviews} Verified)</span>
                                </div>
                                <div className="w-px h-4 bg-zinc-100"></div>
                                <div className="flex items-center gap-2 text-[11px] font-bold text-green-600 uppercase tracking-widest">
                                    <ShieldCheck size={14} /> In Stock
                                </div>
                            </div>

                            <div className="flex items-baseline gap-4 mb-4">
                                <span className="text-[32px] font-bold text-[#df8448]">${product.price.toFixed(2)}</span>
                                {product.oldPrice && (
                                    <span className="text-[20px] text-zinc-300 line-through font-medium">${product.oldPrice.toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        {/* Add to Cart Area */}
                        <div className="space-y-6 mb-12 p-8 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm shadow-zinc-200/20">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center border-2 border-white rounded-[4px] bg-white shadow-sm">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="px-4 py-3 text-zinc-400 hover:text-[#3e4c57] transition-colors"
                                    >-</button>
                                    <span className="w-12 text-center font-bold text-[#3e4c57]">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="px-4 py-3 text-zinc-400 hover:text-[#3e4c57] transition-colors"
                                    >+</button>
                                </div>
                                <button
                                    onClick={() => {
                                        for (let i = 0; i < quantity; i++) addItem(product);
                                    }}
                                    className="flex-1 bg-[#df8448] text-white h-[54px] rounded-[4px] font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 hover:bg-[#c9713a] transition-all duration-500"
                                >
                                    Add to cart
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    <Truck size={14} className="text-[#df8448]" /> Free Express Shipping
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    <RotateCcw size={14} className="text-[#df8448]" /> 30-Day Health Trial
                                </div>
                            </div>
                        </div>

                        {/* Tabs Section */}
                        <div className="mt-4">
                            <div className="flex items-center gap-8 border-b border-zinc-100 mb-8 overflow-x-auto overflow-y-hidden scrollbar-hide">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`pb-4 text-[12px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#3e4c57]' : 'text-zinc-300 hover:text-zinc-400'
                                            }`}
                                    >
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="tab-underline"
                                                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#df8448]"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="min-h-[200px]">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'description' && (
                                        <motion.div
                                            key="desc"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-zinc-500 text-[15px] leading-[1.8]"
                                        >
                                            <p className="mb-4">
                                                {product.description || "Expertly crafted for superior spinal alignment and long-term pet health."}
                                            </p>
                                            <p>
                                                Featuring our proprietary Bio-Fit™ technology, this product adjusts to your pet's natural posture, reducing muscular fatigue and promoting better circulation during rest or activity.
                                            </p>
                                        </motion.div>
                                    )}
                                    {activeTab === 'specs' && (
                                        <motion.div
                                            key="specs"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="grid grid-cols-1 gap-4"
                                        >
                                            {[
                                                { label: "Material", value: "Bio-Synthetic Ergo-Fiber" },
                                                { label: "Padding", value: "Memory Foam (Veterinary Grade)" },
                                                { label: "Weight", value: "Lightweight (Aerospace Aluminum)" },
                                                { label: "Warranty", value: "Lifetime Health Guarantee" }
                                            ].map((spec, i) => (
                                                <div key={i} className="flex justify-between py-3 border-b border-zinc-50 text-[13px]">
                                                    <span className="font-bold text-[#3e4c57] uppercase tracking-wide">{spec.label}</span>
                                                    <span className="text-zinc-500">{spec.value}</span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                    {activeTab === 'shipping' && (
                                        <motion.div
                                            key="shipping"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-zinc-500 text-[15px] leading-[1.8]"
                                        >
                                            <ul className="space-y-4">
                                                <li className="flex gap-3 items-start">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#df8448] mt-2 flex-shrink-0" />
                                                    <span>Free standard shipping for all US orders over $50.</span>
                                                </li>
                                                <li className="flex gap-3 items-start">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#df8448] mt-2 flex-shrink-0" />
                                                    <span>Express 2-day delivery available at checkout.</span>
                                                </li>
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
