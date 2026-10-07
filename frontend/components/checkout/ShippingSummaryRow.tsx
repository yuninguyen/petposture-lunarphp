"use client";

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ShippingInfoModal } from './ShippingInfoModal';

// The "Shipping" line of the order summary, identical on the checkout page and the order confirmation page:
// one line: the label with the shipping method that was chosen, its help dialog, and the amount.
export function ShippingSummaryRow({ amount, method }: { amount: string; method?: string | null }) {
    const [showInfo, setShowInfo] = useState(false);

    // "Standard Shipping" / "Express Shipping" -> "Standard" / "Express": the line already says Shipping.
    const shortMethod = method?.replace(/\s+shipping$/i, '').trim() || method || '';

    return (
        <div className="flex items-center justify-between text-[14px] text-[#333333]">
            <div className="flex items-center gap-1.5">
                <span>
                    Shipping{shortMethod ? <span className="text-[#707070]"> ({shortMethod})</span> : null}
                </span>
                <button
                    type="button"
                    onClick={() => setShowInfo(true)}
                    aria-label="Shipping details"
                    className="text-[#9aa1a9] transition hover:text-[#707070]"
                >
                    <HelpCircle size={14} />
                </button>
            </div>
            <span className="font-medium">{amount}</span>
            <ShippingInfoModal open={showInfo} onClose={() => setShowInfo(false)} />
        </div>
    );
}
