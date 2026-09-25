"use client";

import Image from 'next/image';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Minus, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

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
                            <h2 className="text-[16px] font-black text-primary uppercase tracking-[0.08em] ml-4">
                                Cart
                            </h2>
                            <Button
                                type="button"
                                size="icon"
                                variant="quiet"
                                onClick={() => setCartOpen(false)}
                                aria-label="Close cart"
                                className="absolute right-6"
                            >
                                <X size={20} strokeWidth={2.5} aria-hidden="true" />
                            </Button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 scrollbar-hide">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                                        <ShoppingBag size={32} className="text-zinc-200" />
                                    </div>
                                    <p className="text-[14px] font-bold text-primary uppercase tracking-widest mb-2">Your cart is empty</p>
                                    <p className="text-sm text-zinc-400 mb-8">Add items to get started</p>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setCartOpen(false)}
                                        className="shadow-lg shadow-zinc-200"
                                    >
                                        Continue Shopping
                                    </Button>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.variantId} className="flex gap-4 items-start">
                                        {/* Image */}
                                        <div className="w-[64px] h-[64px] bg-white rounded-[4px] overflow-hidden flex-shrink-0 border border-zinc-100 group relative">
                                            <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 
                                                title={item.name}
                                                className="text-sm font-bold text-primary leading-tight hover:text-rust transition-colors cursor-pointer truncate"
                                            >
                                                {item.name}
                                            </h3>

                                            <div className="flex justify-between items-center mt-2">
                                                <div className="flex items-center bg-zinc-50 rounded-[4px] w-fit border border-zinc-100">
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="quiet"
                                                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                        aria-label="Decrease quantity"
                                                    >
                                                        <Minus size={10} strokeWidth={3} aria-hidden="true" />
                                                    </Button>
                                                    <span className="px-2 text-sm font-black text-primary min-w-[20px] text-center" aria-label="Quantity">{item.quantity}</span>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="quiet"
                                                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                        aria-label="Increase quantity"
                                                    >
                                                        <Plus size={10} strokeWidth={3} aria-hidden="true" />
                                                    </Button>
                                                </div>
                                                <span className="text-sm font-black text-rust">
                                                    ${(item.price * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Remove Button - Circular logic */}
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="quiet"
                                            onClick={() => removeItem(item.variantId)}
                                            aria-label="Remove item"
                                            className="mt-0.5 flex-shrink-0"
                                        >
                                            <X size={12} strokeWidth={3} aria-hidden="true" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer - Professional Action Bar */}
                        {items.length > 0 && (
                            <div className="p-8 bg-white border-t border-zinc-100 flex flex-col gap-4">
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-primary text-sm font-bold uppercase tracking-wider">Subtotal:</span>
                                    <span className="text-[18px] font-black text-primary">${totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="h-[1px] bg-zinc-100 w-full mb-2" />

                                <div className="flex flex-col gap-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => { setCartOpen(false); router.push('/cart'); }}
                                        className="w-full"
                                    >
                                        View Cart
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => { setCartOpen(false); router.push('/checkout'); }}
                                        className="w-full shadow-xl shadow-orange-500/10"
                                    >
                                        Checkout
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
