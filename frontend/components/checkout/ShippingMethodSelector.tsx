import React from 'react';
import { Truck } from 'lucide-react';

export interface ShippingMethodOption {
    id: string;
    name: string;
    description?: string;
    priceLabel: string;
}

interface ShippingMethodSelectorProps {
    value: string;
    onChange: (method: string) => void;
    options: ShippingMethodOption[];
    onActivate: () => void;
}

export function ShippingMethodSelector({
    value,
    onChange,
    options,
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
                {options.map((option, index) => (
                    <label
                        key={option.id}
                        className={`flex cursor-pointer items-center justify-between p-4 text-[14px] transition ${index < options.length - 1 ? 'border-b border-[#d9d9d9]' : ''} ${value === option.id ? 'bg-[#f7faff]' : 'hover:bg-[#fbfbfc]'}`}
                    >
                        <div className="flex items-center gap-4">
                            <input
                                type="radio"
                                name="shippingMethod"
                                checked={value === option.id}
                                onChange={() => onChange(option.id)}
                                className="h-4 w-4 border-[#d9d9d9] text-[#197bbd]"
                            />
                            <div>
                                <span className="text-[#333333]">{option.name}</span>
                                {option.description && (
                                    <p className="mt-0.5 text-[12px] text-[#707070]">{option.description}</p>
                                )}
                            </div>
                        </div>
                        <span className="font-semibold text-[#333333]">{option.priceLabel}</span>
                    </label>
                ))}
            </div>
        </section>
    );
}
