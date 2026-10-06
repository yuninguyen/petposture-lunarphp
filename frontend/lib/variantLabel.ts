import type { ProductVariant } from '../types/shop';

/** "Size: M · Color: Black", or null for a variant without options (nothing worth showing). */
export function variantLabelOf(variant?: ProductVariant): string | null {
    const label = (variant?.options ?? []).map(o => (o.option ? `${o.option}: ${o.value}` : o.value)).join(' · ');
    return label || null;
}
