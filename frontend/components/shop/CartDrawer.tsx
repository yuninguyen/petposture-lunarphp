"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Minus, Plus, Trash2 } from 'lucide-react';
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
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col font-hanken"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <ShoppingBag className="text-[#3e4c57]" size={20} />
                                <h2 className="text-[18px] font-bold text-[#3e4c57] uppercase tracking-wide">
                                    Your Cart ({items.length})
                                </h2>
                            </div>
                            <button
                                onClick={() => setCartOpen(false)}
                                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
                                    <ShoppingBag size={48} className="mb-4 opacity-20" />
                                    <p className="text-[16px] font-medium">Your cart is empty</p>
                                    <button
                                        onClick={() => setCartOpen(false)}
                                        className="mt-6 text-[#df8448] font-bold text-[13px] uppercase tracking-widest hover:underline"
                                    >
                                        Continue Shopping
                                    </button>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.id} className="flex gap-4 items-center group">
                                        <div className="w-20 h-20 bg-zinc-50 rounded-[8px] overflow-hidden flex-shrink-0 border border-zinc-100">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[13px] font-bold text-[#3e4c57] leading-tight truncate">
                                                {item.name}
                                            </h3>
                                            <p className="text-[#df8448] font-bold mt-1 text-[14px]">
                                                ${item.price.toFixed(2)}
                                            </p>

                                            <div className="flex items-center gap-4 mt-3">
                                                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-[4px] overflow-hidden">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className="px-2 py-1 text-zinc-500 hover:bg-zinc-200 transition-colors"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="px-3 text-[13px] font-bold text-[#3e4c57]">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="px-2 py-1 text-zinc-500 hover:bg-zinc-200 transition-colors"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer / Checkout */}
                        {items.length > 0 && (
                            <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-zinc-500 font-medium">Subtotal</span>
                                    <span className="text-[20px] font-black text-[#3e4c57]">${totalAmount.toFixed(2)}</span>
                                </div>
                                <p className="text-zinc-400 text-[12px] mb-6">Taxes and shipping calculated at checkout.</p>
                                <button
                                    onClick={() => { setCartOpen(false); router.push('/checkout'); }}
                                    className="w-full bg-[#df8448] text-white py-4 rounded-[4px] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-[#c9713a] transition-all flex items-center justify-center gap-2"
                                >
                                    Secure Checkout
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
