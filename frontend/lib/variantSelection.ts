import type { ProductVariant } from '../types/shop';

/** The chosen value id per option name, e.g. { Size: 52, Color: 7 }. */
export type VariantSelection = Record<string, number>;

export function selectionOf(variant: ProductVariant | null | undefined): VariantSelection {
    const selection: VariantSelection = {};
    variant?.options.forEach((opt) => {
        if (opt.option) selection[opt.option] = opt.valueId;
    });
    return selection;
}

function matches(variant: ProductVariant, selection: VariantSelection): boolean {
    return variant.options.every((opt) => !opt.option || selection[opt.option] === opt.valueId);
}

export function variantFor(variants: ProductVariant[], selection: VariantSelection): ProductVariant | undefined {
    return variants.find((variant) => matches(variant, selection));
}

/**
 * What picking `valueId` for `optionName` (the other options as they are) leads to: a variant that can be
 * bought, one that is sold out, or no variant at all (that combination is not offered).
 */
export function choiceState(
    variants: ProductVariant[],
    selection: VariantSelection,
    optionName: string,
    valueId: number,
): 'available' | 'sold_out' | 'not_offered' {
    const next = { ...selection, [optionName]: valueId };
    const candidates = variants.filter((variant) => matches(variant, next));

    if (candidates.length === 0) return 'not_offered';
    return candidates.some((variant) => variant.available) ? 'available' : 'sold_out';
}
