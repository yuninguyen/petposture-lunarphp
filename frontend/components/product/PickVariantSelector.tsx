'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PickVariant, ProductPick } from '@/types/shop';
import { buttonClasses } from '@/components/ui/Button';
import { PICK_DISCLOSURE, pickCtaLabel, pickPriceParts } from '@/lib/pick';

type Selection = { variants: PickVariant[]; selected: PickVariant | null; select: (id: number) => void };

const PickVariantContext = createContext<Selection>({ variants: [], selected: null, select: () => {} });

// A Pick with two or more variants lets the reader choose one; the buy box and the quick specs follow the
// choice. With one variant (or none listed) nothing here changes the page. The provider draws no markup of
// its own, so the page layout is the same either way.
export function PickVariantProvider({ variants = [], children }: { variants?: PickVariant[]; children: ReactNode }) {
    const [selectedId, setSelectedId] = useState<number | null>(variants[0]?.id ?? null);
    const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0] ?? null;

    return (
        <PickVariantContext.Provider value={{ variants, selected, select: setSelectedId }}>
            {children}
        </PickVariantContext.Provider>
    );
}

export function usePickVariant(): Selection {
    return useContext(PickVariantContext);
}

/** "Colour" when every variant differs by that one option, otherwise a general "Options". */
function selectorLabel(variants: PickVariant[]): string {
    const names = new Set(variants.flatMap((variant) => variant.options.map((option) => option.name ?? '')));

    return names.size === 1 && [...names][0] !== '' ? [...names][0] : 'Options';
}

export function PickBuyBox({ pick }: { pick: ProductPick }) {
    const { variants, selected, select } = usePickVariant();
    const price = pickPriceParts(selected ? { ...pick, referencePrice: selected.referencePrice } : pick);
    const goUrl = selected?.goUrl ?? pick.goUrl;
    const label = selectorLabel(variants);

    return (
        <>
            {variants.length > 1 && (
                <fieldset className="mb-4">
                    <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                        {label}: <span className="text-primary">{selected?.label}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                        {variants.map((variant) => {
                            const active = variant.id === selected?.id;

                            return (
                                <button
                                    key={variant.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => select(variant.id)}
                                    className={`min-h-[40px] rounded-[3px] border px-4 py-2 text-sm font-bold transition-colors ${
                                        active ? 'border-secondary bg-secondary-light text-rust' : 'border-zinc-200 text-primary hover:border-secondary'
                                    }`}
                                >
                                    {variant.label}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}
            {price && (
                <div className="mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{price.label}</p>
                    <p className="py-[10px] text-[32px] font-bold leading-tight text-primary">{price.amount}</p>
                    <p className="text-xs text-zinc-500">{price.note}</p>
                </div>
            )}
            <a
                href={goUrl}
                target="_blank"
                rel="sponsored noopener"
                className={buttonClasses({ variant: 'primary', size: 'md', className: 'min-h-[52px] w-full gap-[9px] shadow-xl shadow-orange-500/20' })}
            >
                {pickCtaLabel(pick)}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                    <path d="M7 17L17 7M9 7h8v8" />
                </svg>
            </a>
            <p className="mt-3 text-xs leading-5 text-zinc-500">{PICK_DISCLOSURE}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">No made-up star ratings: just pros and cons.</p>
        </>
    );
}

/** The quick specs, with the chosen variant's option values (Colour: Camo) taking the place of a same-named line. */
export function PickSpecs({ specs, className }: { specs: { label: string; value: string }[]; className: string }) {
    const { selected } = usePickVariant();
    const fromVariant = (selected?.options ?? []).filter((option): option is { name: string; value: string } => Boolean(option.name));
    const variantLabels = new Set(fromVariant.map((option) => option.name.toLowerCase()));
    const merged = [
        ...fromVariant.map((option) => ({ label: option.name, value: option.value })),
        ...specs.filter((spec) => !variantLabels.has(spec.label.toLowerCase())),
    ];

    if (merged.length === 0) return null;

    return (
        <div className={className}>
            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Quick specs</h3>
            <dl className="divide-y divide-zinc-100 text-sm">
                {merged.map((spec) => (
                    <div key={spec.label} className="flex justify-between gap-4 py-2.5">
                        <dt className="font-semibold text-primary">{spec.label}</dt>
                        <dd className="text-right text-zinc-600">{spec.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
