"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Minus, Plus, X, ChevronRight, ArrowLeft, Tag } from 'lucide-react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api';
import { getOrderTotal, getShippingAmount } from '@/lib/pricing';

export default function CartPage() {
    const { items, updateQuantity, removeItem, totalAmount, coupon, setCoupon } = useCart();
    const router = useRouter();
    const [couponCode, setCouponCode] = useState(coupon.code);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        setCouponCode(coupon.code);
    }, [coupon.code]);

    const shippingPrice = getShippingAmount(totalAmount, coupon);
    const finalTotal = getOrderTotal(totalAmount, coupon);

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
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/apply-coupon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    coupon_code: couponCode.trim(),
                    items: items.map(item => ({
                        variantId: item.variantId,
                        quantity: item.quantity
                    }))
                })
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
            <div className="bg-zinc-50 border-b border-zinc-100 py-12 px-4">
                <div className="max-w-[1200px] mx-auto">
                    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-[11px] md:text-[13px] font-black uppercase tracking-[0.2em]">
                        <div className="flex items-center gap-3 text-[#df8448]">
                            <span className="w-6 h-6 rounded-full bg-[#df8448] text-white flex items-center justify-center text-[10px]">1</span>
                            <span>Shopping Cart</span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300" />
                        <div className="flex items-center gap-3 text-zinc-400">
                            <span className="w-6 h-6 rounded-full bg-zinc-200 text-white flex items-center justify-center text-[10px]">2</span>
                            <span>Checkout Details</span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300" />
                        <div className="flex items-center gap-3 text-zinc-400">
                            <span className="w-6 h-6 rounded-full bg-zinc-200 text-white flex items-center justify-center text-[10px]">3</span>
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
                        <h2 className="text-[24px] font-bold text-[#3e4c57] mb-4 uppercase tracking-widest">Your Cart is Empty</h2>
                        <p className="text-zinc-400 mb-8 max-w-md mx-auto">Looks like you haven&apos;t added anything to your cart yet. Explore our shop to find the best for your pet.</p>
                        <Link href="/shop" className="bg-[#df8448] text-white px-10 py-5 rounded-[4px] text-[12px] font-black uppercase tracking-widest hover:bg-[#c9713a] transition-all shadow-xl shadow-orange-500/10">
                            Return to Shop
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-16">
                        {/* Cart Table Area */}
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-zinc-200 text-[11px] font-black text-[#3e4c57] uppercase tracking-[0.2em]">
                                        <th className="pb-6 w-12"></th>
                                        <th className="pb-6">Product</th>
                                        <th className="pb-6 text-center">Price</th>
                                        <th className="pb-6 text-center">Quantity</th>
                                        <th className="pb-6 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {items.map(item => (
                                        <tr key={item.variantId} className="group">
                                            <td className="py-8">
                                                <button
                                                    onClick={() => removeItem(item.variantId)}
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                                >
                                                    <X size={16} strokeWidth={2.5} />
                                                </button>
                                            </td>
                                            <td className="py-8">
                                                <div className="flex items-center gap-6">
                                                    <div className="relative w-[100px] h-[120px] bg-zinc-50 rounded-[4px] overflow-hidden flex-shrink-0 border border-zinc-100">
                                                        <Image src={item.image} alt={item.name} fill sizes="100px" className="object-cover" />
                                                    </div>
                                                    <h3 className="text-[14px] font-bold text-[#3e4c57] hover:text-[#df8448] transition-colors">
                                                        {item.name}
                                                    </h3>
                                                </div>
                                            </td>
                                            <td className="py-8 text-center text-[15px] font-medium text-zinc-500">
                                                ${item.price.toFixed(2)}
                                            </td>
                                            <td className="py-8 text-center">
                                                <div className="inline-flex items-center bg-zinc-50 border border-zinc-200 rounded-[4px] overflow-hidden">
                                                    <button
                                                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                        className="px-4 py-2.5 text-zinc-500 hover:bg-zinc-200 transition-colors"
                                                    >
                                                        <Minus size={14} strokeWidth={2.5} />
                                                    </button>
                                                    <span className="px-6 text-[14px] font-bold text-[#3e4c57] min-w-[50px]">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                        className="px-4 py-2.5 text-zinc-500 hover:bg-zinc-200 transition-colors"
                                                    >
                                                        <Plus size={14} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-8 text-right text-[15px] font-black text-[#df8448]">
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-12 flex justify-between items-center">
                                <Link href="/shop" className="inline-flex items-center gap-2 group text-[11px] font-black uppercase tracking-widest text-[#3e4c57] border-2 border-zinc-100 px-8 py-4 rounded-[4px] hover:bg-zinc-50 transition-all">
                                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                    Continue Shopping
                                </Link>
                            </div>
                        </div>

                        {/* Sidebar Totals */}
                        <div className="w-full lg:w-[400px]">
                            <div className="bg-zinc-50 border border-zinc-100 rounded-[8px] p-8 md:p-10 sticky top-[130px]">
                                <h2 className="text-[14px] font-black text-[#3e4c57] uppercase tracking-[0.2em] mb-10 pb-6 border-b border-zinc-200">
                                    Cart Totals
                                </h2>

                                <div className="space-y-6 mb-10">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Subtotal</span>
                                        <span className="font-bold text-[#3e4c57]">${totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-start text-[13px]">
                                        <span className="text-zinc-500 font-bold uppercase tracking-wider">Shipping</span>
                                        <div className="text-right">
                                            <p className="font-bold text-[#3e4c57]">{shippingPrice === 0 ? 'FREE' : `$${shippingPrice.toFixed(2)}`}</p>
                                            <p className="text-[10px] text-zinc-400 mt-1">Free shipping on orders over $50</p>
                                        </div>
                                    </div>
                                    {coupon.discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-[13px] text-[#df8448]">
                                            <span className="font-bold uppercase tracking-wider">Discount</span>
                                            <span className="font-bold">-${coupon.discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="h-[1px] bg-zinc-200 my-6" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-[#3e4c57] font-black uppercase tracking-widest text-[14px]">Total</span>
                                        <span className="text-[24px] font-black text-[#df8448]">${finalTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => router.push('/checkout')}
                                    className="w-full bg-[#df8448] text-white py-5 rounded-[4px] font-black uppercase tracking-[0.25em] text-[12px] shadow-2xl shadow-orange-500/20 hover:bg-[#c9713a] transition-all"
                                >
                                    Proceed to Checkout
                                </button>

                                {/* Coupon Section */}
                                <div className="mt-12 pt-10 border-t border-zinc-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Tag size={16} className="text-[#df8448]" />
                                        <span className="text-[11px] font-black text-[#3e4c57] uppercase tracking-widest">Coupon Code</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value)}
                                            placeholder="Coupon code"
                                            className="w-full bg-white border border-zinc-200 rounded-[4px] px-6 py-4 text-[13px] outline-none focus:border-[#df8448] transition-colors"
                                        />
                                        <button
                                            onClick={handleApplyCoupon}
                                            disabled={isApplying}
                                            className="w-full bg-zinc-100 text-[#3e4c57] py-4 rounded-[4px] text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
                                        >
                                            {isApplying ? 'Applying...' : 'Apply Coupon'}
                                        </button>
                                        {coupon.message && (
                                            <p className={`text-[11px] mt-2 font-bold ${coupon.isError ? 'text-red-500' : 'text-green-600'}`}>
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
