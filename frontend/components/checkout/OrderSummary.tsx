"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, HelpCircle, ShieldCheck, ShoppingBag, Tag, X } from 'lucide-react';

interface CartItem {
    variantId: number;
    name: string;
    category: string;
    image: string;
    price: number;
    quantity: number;
}

interface CouponState {
    code: string;
    discountAmount: number;
    message: string | null;
    isError: boolean;
    freeShipping: boolean;
}

interface TaxQuote {
    source_label?: string | null;
    effective_date?: string | null;
}

interface OrderSummaryProps {
    items: CartItem[];
    coupon: CouponState;
    couponCode: string;
    setCouponCode: (v: string) => void;
    onApplyCoupon: () => void;
    totalAmount: number;
    shippingAmount: number;
    taxAmount: number;
    taxRate: number;
    taxQuote: TaxQuote | null;
    finalTotal: number;
}

export function OrderSummary({
    items,
    coupon,
    couponCode,
    setCouponCode,
    onApplyCoupon,
    totalAmount,
    shippingAmount,
    taxAmount,
    taxRate,
    finalTotal,
}: OrderSummaryProps) {
    const [showShippingInfo, setShowShippingInfo] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);

    return (
        <aside className={`order-first w-full border-b border-[#e8e8ea] bg-[#fafafa] px-4 ${mobileExpanded ? 'py-6' : 'py-3'} md:px-8 lg:order-last lg:w-[440px] lg:border-b-0 lg:border-l lg:px-10 lg:py-12`}>
            <div className="lg:sticky lg:top-12">
                {/* Mobile: compact toggle bar (total + show/hide) */}
                <button
                    type="button"
                    onClick={() => setMobileExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between lg:hidden"
                    aria-expanded={mobileExpanded}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-rust">
                            <ShoppingBag size={16} />
                        </div>
                        <span className="text-[15px] font-semibold text-[#333333]">
                            Order Summary
                        </span>
                        <ChevronDown size={16} className={`text-[#707070] transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    <span className="text-[16px] font-bold text-[#333333]">${finalTotal.toFixed(2)}</span>
                </button>

                <div className={`${mobileExpanded ? 'mt-6 flex' : 'hidden'} flex-col space-y-8 lg:mt-0 lg:flex`}>
                    {/* Line items */}
                    {items.length > 0 && (
                    <div className="max-h-[380px] space-y-4 overflow-y-auto overflow-x-hidden p-1 pr-2">
                        {items.map((item) => (
                            <div key={item.variantId} className="flex items-center gap-4 py-1">
                                <div className="relative h-16 w-16 flex-shrink-0 rounded-[10px] border border-[#e6e6e6] bg-white">
                                    <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain p-1" />
                                    <span className="absolute -right-2 -top-2 z-10 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#111827] px-1 text-xs font-bold text-white shadow-[0_0_0_2px_#fff]">
                                        {item.quantity}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="line-clamp-1 text-sm font-medium text-[#333333]">{item.name}</h3>
                                    <p className="mt-0.5 text-xs text-[#707070]">{item.category}</p>
                                </div>
                                <span className="text-[14px] font-medium text-[#333333]">
                                    ${(item.price * item.quantity).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                    )}

                    {/* Coupon input */}
                    <div className="border-t border-[#e6e6e6] pt-6">
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    placeholder="Discount code"
                                    className="h-[44px] w-full rounded-[8px] border border-[#d9d9d9] bg-white pl-10 pr-3.5 text-[14px] outline-none transition focus:border-secondary"
                                />
                                <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707070]" />
                            </div>
                            <button
                                type="button"
                                onClick={onApplyCoupon}
                                className="h-[44px] rounded-[8px] bg-[#e1e1e1] px-5 text-sm font-semibold text-[#333333] transition hover:bg-[#d6d6d6]"
                            >
                                Apply
                            </button>
                        </div>
                        {coupon.message && (
                            <p className={`mt-2 text-sm font-medium ${coupon.isError ? 'text-[#dc2626]' : 'text-[#0f9f61]'}`}>
                                {coupon.message}
                            </p>
                        )}
                    </div>

                    {/* Price breakdown */}
                    <div className="space-y-3 border-t border-[#e6e6e6] pt-6">
                        <div className="flex items-center justify-between text-[14px] text-[#333333]">
                            <span>Subtotal</span>
                            <span className="font-medium">${totalAmount.toFixed(2)}</span>
                        </div>

                        {coupon.discountAmount > 0 && (
                            <div className="flex items-center justify-between text-[14px] text-[#0f9f61]">
                                <div className="flex items-center gap-1.5">
                                    <Tag size={14} />
                                    <span>Discount ({coupon.code})</span>
                                </div>
                                <span className="font-medium">-${coupon.discountAmount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-[14px] text-[#333333]">
                            <div className="flex items-center gap-1.5">
                                <span>Shipping</span>
                                <button
                                    type="button"
                                    onClick={() => setShowShippingInfo(true)}
                                    aria-label="Shipping details"
                                    className="text-[#9aa1a9] transition hover:text-[#707070]"
                                >
                                    <HelpCircle size={14} />
                                </button>
                            </div>
                            <span className="font-medium">
                                {shippingAmount === 0 ? 'Free' : `$${shippingAmount.toFixed(2)}`}
                            </span>
                        </div>

                        {taxAmount > 0 && (
                            <div className="flex items-center justify-between text-[14px] text-[#333333]">
                                <div className="pr-3">
                                    <span>
                                        Estimated tax ({(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 2)}%)
                                    </span>
                                </div>
                                <span className="font-medium">${taxAmount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-3 text-[18px] font-bold text-[#333333]">
                            <span>Total</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs font-normal text-[#707070]">USD</span>
                                <span>${finalTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-[10px] border border-[#e6f3ea] bg-[#f6fbf7] px-3 py-2 text-sm text-[#4d6357]">
                            <ShieldCheck size={14} className="text-[#0f9f61]" />
                            <span>Secure checkout and encrypted payment details.</span>
                        </div>
                    </div>
                </div>
            </div>

            {showShippingInfo && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
                    onClick={() => setShowShippingInfo(false)}
                >
                    <div
                        className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[16px] font-semibold text-[#1c1c1f]">Shipping</h3>
                            <button
                                type="button"
                                onClick={() => setShowShippingInfo(false)}
                                aria-label="Close"
                                className="text-[#707070] transition hover:text-[#333333]"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 text-sm leading-[1.6] text-[#4a4a4a]">
                            <p>We currently ship to the 48 contiguous United States only — no Alaska, Hawaii, P.O. Boxes, or APO/FPO addresses.</p>
                            <p><strong className="text-[#1c1c1f]">Processing:</strong> 2–4 business days before your order ships.</p>
                            <p><strong className="text-[#1c1c1f]">Transit:</strong> 3–8 business days once shipped, for a total of about 7–10 business days from order to delivery.</p>
                            <p><strong className="text-[#1c1c1f]">Rates:</strong> calculated at checkout based on cart weight and delivery destination.</p>
                            <p>Your order may arrive in more than one package if items ship from different warehouses — each package gets its own tracking number.</p>
                            <a
                                href="/shipping-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block font-medium text-rust hover:underline"
                            >
                                Read the full shipping policy →
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
