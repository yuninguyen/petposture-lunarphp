"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import dynamic from 'next/dynamic';
const Footer = dynamic(() => import('@/components/Footer'));
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Minus, Plus, X, ChevronRight, ArrowLeft, Tag } from 'lucide-react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api';
import { fetchApi } from '@/lib/fetchApi';
import { getShippingAmount } from '@/lib/pricing';

export default function CartPage() {
    const { items, updateQuantity, removeItem, totalAmount, coupon, setCoupon } = useCart();
    const router = useRouter();
    const [couponCode, setCouponCode] = useState(coupon.code);
    const [isApplying, setIsApplying] = useState(false);
    const [standardShippingPrice, setStandardShippingPrice] = useState<number | null>(null);

    useEffect(() => {
        setCouponCode(coupon.code);
    }, [coupon.code]);

    useEffect(() => {
        let cancelled = false;

        const loadShippingRate = async () => {
            try {
                const apiBase = getApiBaseUrl();
                const params = new URLSearchParams({
                    subtotal_minor: String(Math.round(totalAmount * 100)),
                    ...(coupon.code ? { coupon_code: coupon.code } : {}),
                });
                const response = await fetch(`${apiBase}/api/checkout/shipping-rates?${params.toString()}`);
                const data = await response.json();
                const standardRate = data?.rates?.find((rate: { id: string; price: number }) => rate.id === 'standard');

                if (!response.ok || !standardRate || cancelled) {
                    return;
                }

                setStandardShippingPrice(standardRate.price);
            } catch {
                if (!cancelled) {
                    setStandardShippingPrice(null);
                }
            }
        };

        void loadShippingRate();

        return () => {
            cancelled = true;
        };
    }, [totalAmount, coupon.code]);

    const shippingPrice = standardShippingPrice ?? getShippingAmount(totalAmount, coupon);
    const finalTotal = Math.max(0, totalAmount - coupon.discountAmount + shippingPrice);

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;

        setIsApplying(true);
        setCoupon({
            code: couponCode.trim(),
            discountAmount: 0,
            message: null,
            isError: false,
            type: null,
            amount: null,
            freeShipping: false,
        });

        try {
            const response = await fetchApi('/api/apply-coupon', {
                method: 'POST',
                body: {
                    coupon_code: couponCode.trim(),
                    items: items.map(item => ({
                        variantId: item.variantId,
                        quantity: item.quantity
                    }))
                },
            });

            const data = await response.json();

            if (response.ok) {
                setCoupon({
                    code: couponCode.trim(),
                    discountAmount: data.discount_amount ?? 0,
                    message: data.message,
                    isError: false,
                    type: data.coupon?.type ?? null,
                    amount: data.coupon?.amount ?? null,
                    freeShipping: Boolean(data.coupon?.free_shipping),
                });
            } else {
                let message = data.message || 'Failed to apply coupon.';
                if (response.status === 422 && data.errors) {
                    const firstError = Object.values(data.errors)[0] as string[];
                    message = firstError[0] || message;
                }
                setCoupon({
                    code: couponCode.trim(),
                    discountAmount: 0,
                    message,
                    isError: true,
                    type: null,
                    amount: null,
                    freeShipping: false,
                });
            }
        } catch (error) {
            console.error('Coupon Application Error:', error);
            setCoupon({
                code: couponCode.trim(),
                discountAmount: 0,
                message: 'Error connecting to server.',
                isError: true,
                type: null,
                amount: null,
                freeShipping: false,
            });
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <main className="min-h-screen bg-white font-hanken flex flex-col">
            <Header />

            {/* Stepper Section */}
            <div className="hidden md:block bg-zinc-50 border-b border-zinc-100 py-12 px-4">
                <div className="max-w-[1200px] mx-auto">
                    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm font-black uppercase tracking-[0.05em]">
                        <div className="flex items-center gap-3 text-rust">
                            <span className="w-6 h-6 rounded-full bg-secondary text-ink flex items-center justify-center text-xs">1</span>
                            <span>Shopping Cart</span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300" />
                        <div className="flex items-center gap-3 text-zinc-400">
                            <span className="w-6 h-6 rounded-full bg-zinc-200 text-white flex items-center justify-center text-xs">2</span>
                            <span>Checkout Details</span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300" />
                        <div className="flex items-center gap-3 text-zinc-400">
                            <span className="w-6 h-6 rounded-full bg-zinc-200 text-white flex items-center justify-center text-xs">3</span>
                            <span>Order Complete</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 max-w-[1200px] w-full mx-auto p-4 md:p-8 lg:p-12 my-12">
                {items.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                        <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-8">
                            <X size={40} className="text-zinc-200" />
                        </div>
                        <h2 className="text-[24px] font-bold text-primary mb-4 uppercase tracking-wider">Your Cart is Empty</h2>
                        <p className="text-zinc-400 mb-8 max-w-md mx-auto">Looks like you haven&apos;t added anything to your cart yet. Explore our shop to find the best for your pet.</p>
                        <Link href="/shop" className="bg-secondary text-ink px-10 py-5 rounded-[4px] text-sm font-black uppercase tracking-wider hover:bg-secondary-dark transition-all shadow-xl shadow-orange-500/10">
                            Return to Shop
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-16">
                        {/* Cart Table Area */}
                        <div className="flex-1">
                            <div className="w-full">
                                {/* Desktop Header */}
                                <div className="hidden md:flex items-center border-b border-zinc-200 pb-4 text-xs font-black text-primary uppercase tracking-[0.1em]">
                                    <div className="w-10"></div>
                                    <div className="flex-1 text-left">Product</div>
                                    <div className="w-[15%] text-center">Price</div>
                                    <div className="w-[20%] text-center">Quantity</div>
                                    <div className="w-[15%] text-right pr-6">Total</div>
                                </div>
                                
                                <div className="divide-y divide-zinc-100">
                                    {items.map((item, index) => (
                                        <div key={item.variantId} className="py-6 flex flex-col md:flex-row md:items-center relative group">
                                            {/* Remove Button */}
                                            <div className="absolute top-6 right-0 md:relative md:top-0 md:w-10 md:flex-shrink-0 z-10 flex md:items-center md:justify-start">
                                                <button
                                                    onClick={() => removeItem(item.variantId)}
                                                    aria-label="Remove item"
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 bg-white md:bg-transparent"
                                                >
                                                    <X size={16} strokeWidth={2.5} aria-hidden="true" />
                                                </button>
                                            </div>
                                            
                                            {/* Product Info (Image + Name) */}
                                            <div className="flex items-start md:items-center gap-4 flex-1 pr-10 md:pr-4">
                                                <div className="relative w-[80px] h-[80px] md:w-[56px] md:h-[56px] bg-zinc-50 rounded-[6px] overflow-hidden flex-shrink-0 border border-zinc-100">
                                                    <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 80px, 56px" className="object-cover mix-blend-multiply" priority={index === 0} />
                                                </div>
                                                <div className="flex-1 flex flex-col justify-center min-h-[80px] md:min-h-0">
                                                    <h3 className="text-[14px] font-semibold text-primary hover:text-rust transition-colors leading-snug">
                                                        {item.name}
                                                    </h3>
                                                    {/* Mobile Price */}
                                                    <div className="md:hidden text-[14px] font-medium text-zinc-500 mt-1">
                                                        ${item.price.toFixed(2)}
                                                    </div>
                                                    
                                                    {/* Mobile Quantity & Total */}
                                                    <div className="md:hidden flex items-center justify-between mt-3">
                                                        <div className="inline-flex items-center bg-white border border-zinc-200 rounded-[4px] overflow-hidden shadow-sm">
                                                            <button
                                                                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                                aria-label="Decrease quantity"
                                                                className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-primary transition-colors"
                                                            >
                                                                <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
                                                            </button>
                                                            <span className="w-6 text-center text-[13px] font-bold text-primary" aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                                aria-label="Increase quantity"
                                                                className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-primary transition-colors"
                                                            >
                                                                <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                        <div className="text-[15px] font-black text-rust">
                                                            ${(item.price * item.quantity).toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Desktop Price */}
                                            <div className="hidden md:block w-[15%] text-center text-[15px] font-medium text-zinc-500">
                                                ${item.price.toFixed(2)}
                                            </div>
                                            
                                            {/* Desktop Quantity */}
                                            <div className="hidden md:flex items-center justify-center w-[20%]">
                                                <div className="inline-flex items-center bg-white border border-zinc-200 rounded-[4px] overflow-hidden shadow-sm">
                                                    <button
                                                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                        aria-label="Decrease quantity"
                                                        className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-primary transition-colors"
                                                    >
                                                        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
                                                    </button>
                                                    <span className="w-6 text-center text-[13px] font-bold text-primary" aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                        aria-label="Increase quantity"
                                                        className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-primary transition-colors"
                                                    >
                                                        <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Desktop Total */}
                                            <div className="hidden md:block w-[15%] text-right pr-6 text-[16px] font-black text-rust">
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-12 flex justify-between items-center">
                                <Link href="/shop" className="inline-flex items-center gap-2 group text-sm font-black uppercase tracking-wider text-primary border-2 border-zinc-100 px-8 py-4 rounded-[4px] hover:bg-zinc-50 transition-all">
                                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                    Continue Shopping
                                </Link>
                            </div>
                        </div>

                        {/* Sidebar Totals */}
                        <div className="w-full lg:w-[400px]">
                            <div className="bg-zinc-50 border border-zinc-100 rounded-[8px] p-8 md:p-10 sticky top-[130px]">
                                <h2 className="text-[14px] font-black text-primary uppercase tracking-[0.05em] mb-10 pb-6 border-b border-zinc-200">
                                    Cart Totals
                                </h2>

                                <div className="space-y-6 mb-10">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Subtotal</span>
                                        <span className="font-bold text-primary">${totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-start text-sm">
                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Shipping</span>
                                        <div className="text-right">
                                            <p className="font-bold text-primary">{shippingPrice === 0 ? 'FREE' : `$${shippingPrice.toFixed(2)}`}</p>
                                            <p className="text-xs text-zinc-400 mt-1">Free shipping on orders over $50</p>
                                        </div>
                                    </div>
                                    {coupon.discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm text-rust">
                                            <span className="font-bold uppercase tracking-wider">Discount</span>
                                            <span className="font-bold">-${coupon.discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="h-[1px] bg-zinc-200 my-6" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-primary font-black uppercase tracking-wider text-[14px]">Total</span>
                                        <span className="text-[24px] font-black text-rust">${finalTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => router.push('/checkout')}
                                    className="w-full bg-secondary text-ink py-5 rounded-[4px] font-black uppercase tracking-[0.05em] text-sm shadow-2xl shadow-orange-500/20 hover:bg-secondary-dark transition-all"
                                >
                                    Proceed to Checkout
                                </button>

                                {/* Coupon Section */}
                                <div className="mt-12 pt-10 border-t border-zinc-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Tag size={16} className="text-rust" />
                                        <span className="text-sm font-black text-primary uppercase tracking-widest">Coupon Code</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value)}
                                            placeholder="Coupon code"
                                            className="w-full bg-white border border-zinc-200 rounded-[4px] px-6 py-4 text-sm outline-none focus:border-secondary transition-colors"
                                        />
                                        <button
                                            onClick={handleApplyCoupon}
                                            disabled={isApplying}
                                            className="w-full bg-zinc-100 text-primary py-4 rounded-[4px] text-sm font-black uppercase tracking-wider hover:bg-zinc-200 transition-all disabled:opacity-50"
                                        >
                                            {isApplying ? 'Applying...' : 'Apply Coupon'}
                                        </button>
                                        {coupon.message && (
                                            <p className={`text-sm mt-2 font-bold ${coupon.isError ? 'text-red-500' : 'text-green-600'}`}>
                                                {coupon.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </main>
    );
}
