import React from 'react';
import { ShieldCheck, ShoppingBag, Tag } from 'lucide-react';

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
    taxQuote,
    finalTotal,
}: OrderSummaryProps) {
    return (
        <aside className="w-full border-l border-[#e8e8ea] bg-[#fafafa] px-4 py-8 md:px-8 lg:w-[440px] lg:px-10 lg:py-12">
            <div className="sticky top-12 space-y-8">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                        <ShoppingBag size={16} />
                    </div>
                    <h2 className="text-[18px] font-semibold text-[#333333]">Order summary</h2>
                </div>

                {/* Line items */}
                <div className="max-h-[380px] space-y-4 overflow-y-auto overflow-x-hidden p-1 pr-2">
                    {items.map((item) => (
                        <div key={item.variantId} className="flex items-center gap-4 py-1">
                            <div className="relative h-16 w-16 flex-shrink-0 rounded-[10px] border border-[#e6e6e6] bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image} alt={item.name} className="h-full w-full object-contain p-1" />
                                <span className="absolute -right-2 -top-2 z-10 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#111827] px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_#fff]">
                                    {item.quantity}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="line-clamp-1 text-[13px] font-medium text-[#333333]">{item.name}</h3>
                                <p className="mt-0.5 text-[11px] text-[#707070]">{item.category}</p>
                            </div>
                            <span className="text-[14px] font-medium text-[#333333]">
                                ${(item.price * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Coupon input */}
                <div className="border-t border-[#e6e6e6] pt-6">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder="Discount code"
                                className="h-[44px] w-full rounded-[8px] border border-[#d9d9d9] bg-white pl-10 pr-3.5 text-[14px] outline-none transition focus:border-[#df8448]"
                            />
                            <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707070]" />
                        </div>
                        <button
                            type="button"
                            onClick={onApplyCoupon}
                            className="h-[44px] rounded-[8px] bg-[#e1e1e1] px-5 text-[13px] font-semibold text-[#333333] transition hover:bg-[#d6d6d6]"
                        >
                            Apply
                        </button>
                    </div>
                    {coupon.message && (
                        <p className={`mt-2 text-[12px] font-medium ${coupon.isError ? 'text-[#dc2626]' : 'text-[#0f9f61]'}`}>
                            {coupon.message}
                        </p>
                    )}
                </div>

                {/* Price breakdown */}
                <div className="space-y-3 border-t border-[#e6e6e6] pt-6">
                    <div className="flex items-center justify-between text-[13px] text-[#333333]">
                        <span>Subtotal</span>
                        <span className="font-medium">${totalAmount.toFixed(2)}</span>
                    </div>

                    {coupon.discountAmount > 0 && (
                        <div className="flex items-center justify-between text-[13px] text-[#0f9f61]">
                            <div className="flex items-center gap-1.5">
                                <Tag size={14} />
                                <span>Discount ({coupon.code})</span>
                            </div>
                            <span className="font-medium">-${coupon.discountAmount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-[13px] text-[#333333]">
                        <span>Shipping</span>
                        <span className="font-medium">
                            {shippingAmount === 0 ? 'Free' : `$${shippingAmount.toFixed(2)}`}
                        </span>
                    </div>

                    {taxAmount > 0 && (
                        <div className="flex items-center justify-between text-[13px] text-[#333333]">
                            <div className="pr-3">
                                <span>
                                    Estimated tax ({(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 2)}%)
                                </span>
                                {taxQuote?.source_label && (
                                    <p className="mt-1 text-[11px] leading-4 text-[#707070]">
                                        {taxQuote.source_label}
                                        {taxQuote.effective_date ? `, effective ${taxQuote.effective_date}` : ''}
                                    </p>
                                )}
                            </div>
                            <span className="font-medium">${taxAmount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 text-[18px] font-bold text-[#333333]">
                        <span>Total</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[11px] font-normal text-[#707070]">USD</span>
                            <span>${finalTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-[10px] border border-[#e6f3ea] bg-[#f6fbf7] px-3 py-2 text-[12px] text-[#4d6357]">
                        <ShieldCheck size={14} className="text-[#0f9f61]" />
                        <span>Secure checkout and encrypted payment details.</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
