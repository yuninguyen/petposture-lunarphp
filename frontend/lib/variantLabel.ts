import type { ProductVariant } from '../types/shop';

/**
 * Items added to the cart before variant labels existed still carry their product's variants;
 * derive the missing label from them (no network call).
 */
export function withVariantLabel<T extends { variantId: number; variantLabel?: string | null; variants?: ProductVariant[] }>(item: T): T & { variantLabel?: string | null } {
    if (item.variantLabel !== undefined) return item;
    return { ...item, variantLabel: variantLabelOf(item.variants?.find(v => v.id === item.variantId)) };
}

/** "Size: M · Color: Black", or null for a variant without options (nothing worth showing). */
export function variantLabelOf(variant?: ProductVariant): string | null {
    const label = (variant?.options ?? []).map(o => (o.option ? `${o.option}: ${o.value}` : o.value)).join(' · ');
    return label || null;
}
