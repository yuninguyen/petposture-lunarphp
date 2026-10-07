"use client";

import React from 'react';
import { X } from 'lucide-react';

// The "Shipping" help dialog of the order summary — shared by the checkout page and the order confirmation page.
export function ShippingInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <div
                className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[16px] font-semibold text-[#1c1c1f]">Shipping</h3>
                    <button
                        type="button"
                        onClick={onClose}
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
    );
}
