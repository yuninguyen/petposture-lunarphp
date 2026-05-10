import React from 'react';
import { Truck } from 'lucide-react';

interface ShippingMethodSelectorProps {
    value: 'standard' | 'express';
    onChange: (method: 'standard' | 'express') => void;
    standardLabel: string;
    expressLabel: string;
    onActivate: () => void;
}

export function ShippingMethodSelector({
    value,
    onChange,
    standardLabel,
    expressLabel,
    onActivate,
}: ShippingMethodSelectorProps) {
    return (
        <section
            className="scroll-mt-8 pt-4"
            onFocusCapture={onActivate}
            onPointerDownCapture={onActivate}
        >
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3eb] text-[#df8448]">
                    <Truck size={16} />
                </div>
                <h2 className="text-[18px] font-semibold text-[#333333]">Shipping method</h2>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-[#d9d9d9] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.03)]">
                <label className={`flex cursor-pointer items-center justify-between border-b border-[#d9d9d9] p-4 text-[14px] transition ${value === 'standard' ? 'bg-[#f7faff]' : 'hover:bg-[#fbfbfc]'}`}>
                    <div className="flex items-center gap-4">
                        <input
                            type="radio"
                            name="shippingMethod"
                            checked={value === 'standard'}
                            onChange={() => onChange('standard')}
                            className="h-4 w-4 border-[#d9d9d9] text-[#197bbd]"
                        />
                        <div>
                            <span className="text-[#333333]">Standard</span>
                            <p className="mt-0.5 text-[12px] text-[#707070]">4 to 7 business days</p>
                        </div>
                    </div>
                    <span className="font-semibold text-[#333333]">{standardLabel}</span>
                </label>

                <label className={`flex cursor-pointer items-center justify-between p-4 text-[14px] transition ${value === 'express' ? 'bg-[#f7faff]' : 'hover:bg-[#fbfbfc]'}`}>
                    <div className="flex items-center gap-4">
                        <input
                            type="radio"
                            name="shippingMethod"
                            checked={value === 'express'}
                            onChange={() => onChange('express')}
                            className="h-4 w-4 border-[#d9d9d9] text-[#197bbd]"
                        />
                        <div>
                            <span className="text-[#333333]">Express</span>
                            <p className="mt-0.5 text-[12px] text-[#707070]">1 to 2 business days</p>
                        </div>
                    </div>
                    <span className="font-semibold text-[#333333]">{expressLabel}</span>
                </label>
            </div>
        </section>
    );
}
