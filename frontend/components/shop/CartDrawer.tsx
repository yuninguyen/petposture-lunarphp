"use client";

import Image from 'next/image';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Minus, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';

export function CartDrawer() {
    const { items, isCartOpen, setCartOpen, updateQuantity, removeItem, totalAmount } = useCart();
    const router = useRouter();

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setCartOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full max-w-[400px] bg-white shadow-2xl z-50 flex flex-col font-hanken"
                    >
                        {/* Header - Centered & Premium */}
                        <div className="relative flex items-center justify-center p-8 border-b border-zinc-100/80">
                            <h2 className="text-[14px] font-black text-[#3e4c57] uppercase tracking-[0.3em] ml-4">
                                Cart
                            </h2>
                            <button
                                onClick={() => setCartOpen(false)}
                                className="absolute right-6 p-2 text-zinc-400 hover:text-[#3e4c57] transition-all hover:rotate-90 duration-300"
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 scrollbar-hide">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                                        <ShoppingBag size={32} className="text-zinc-200" />
                                    </div>
                                    <p className="text-[14px] font-bold text-[#3e4c57] uppercase tracking-widest mb-2">Your cart is empty</p>
                                    <p className="text-[12px] text-zinc-400 mb-8">Add items to get started</p>
                                    <button
                                        onClick={() => setCartOpen(false)}
                                        className="bg-[#3e4c57] text-white px-8 py-4 rounded-[4px] text-[11px] font-black uppercase tracking-widest hover:bg-[#2c363e] transition-all shadow-lg shadow-zinc-200"
                                    >
                                        Continue Shopping
                                    </button>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.variantId} className="flex gap-6 items-center">
                                        {/* Image */}
                                        <div className="w-[80px] h-[100px] bg-zinc-50 rounded-[4px] overflow-hidden flex-shrink-0 border border-zinc-100 group relative">
                                            <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[13px] font-bold text-[#3e4c57] leading-tight mb-1 hover:text-[#df8448] transition-colors cursor-pointer">
                                                {item.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-400">
                                                <span>{item.quantity}</span>
                                                <span>&times;</span>
                                                <span className="text-[#df8448] font-bold">${item.price.toFixed(2)}</span>
                                            </div>

                                            {/* Quantity Adjuster Mini */}
                                            <div className="flex items-center mt-3 bg-zinc-50 rounded-[4px] w-fit border border-zinc-100">
                                                <button
                                                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                    className="px-2.5 py-1 text-zinc-400 hover:text-[#3e4c57] transition-colors"
                                                >
                                                    <Minus size={10} strokeWidth={3} />
                                                </button>
                                                <span className="px-2 text-[11px] font-black text-[#3e4c57] min-w-[20px] text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                    className="px-2.5 py-1 text-zinc-400 hover:text-[#3e4c57] transition-colors"
                                                >
                                                    <Plus size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Remove Button - Circular logic */}
                                        <button
                                            onClick={() => removeItem(item.variantId)}
                                            className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all"
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer - Professional Action Bar */}
                        {items.length > 0 && (
                            <div className="p-8 bg-white border-t border-zinc-100 flex flex-col gap-4">
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-[#3e4c57] text-[13px] font-bold uppercase tracking-widest">Subtotal:</span>
                                    <span className="text-[18px] font-black text-[#3e4c57]">${totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="h-[1px] bg-zinc-100 w-full mb-2" />

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => { setCartOpen(false); router.push('/cart'); }}
                                        className="w-full bg-[#3e4c57] text-white py-4 rounded-[4px] text-[11px] font-black uppercase tracking-[0.25em] hover:bg-[#2c363e] transition-all flex items-center justify-center"
                                    >
                                        View Cart
                                    </button>
                                    <button
                                        onClick={() => { setCartOpen(false); router.push('/checkout'); }}
                                        className="w-full bg-[#df8448] text-white py-4 rounded-[4px] text-[11px] font-black uppercase tracking-[0.25em] shadow-xl shadow-orange-500/10 hover:bg-[#c9713a] transition-all flex items-center justify-center"
                                    >
                                        Checkout
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
