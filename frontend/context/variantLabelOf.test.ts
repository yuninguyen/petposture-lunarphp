import { describe, expect, it } from 'vitest';
import type { ProductVariant } from '../types/shop';
import { variantLabelOf, withVariantLabel } from '../lib/variantLabel';

describe('withVariantLabel', () => {
    const variants = [
        { id: 1, sku: null, price: 10, stock: 5, available: true, options: [{ option: 'Size', valueId: 1, value: 'S' }] },
        { id: 2, sku: null, price: 10, stock: 5, available: true, options: [{ option: 'Size', valueId: 2, value: 'M' }] },
    ];

    it('fills in the label of an old cart item from its stored variants', () => {
        expect(withVariantLabel({ variantId: 2, variants }).variantLabel).toBe('Size: M');
    });

    it('keeps an item that already has a label (or a null one) untouched', () => {
        const labelled = { variantId: 2, variantLabel: 'Size: L', variants };
        const none = { variantId: 2, variantLabel: null, variants };
        expect(withVariantLabel(labelled)).toBe(labelled);
        expect(withVariantLabel(none)).toBe(none);
    });

    it('gives null when the item has no stored variants', () => {
        expect(withVariantLabel({ variantId: 2 }).variantLabel).toBeNull();
    });
});

const variant = (options: ProductVariant['options']): ProductVariant => ({
    id: 1, sku: null, price: 10, stock: 5, available: true, options,
});

describe('variantLabelOf', () => {
    it('joins option name and value for every option of the variant', () => {
        expect(variantLabelOf(variant([
            { option: 'Size', valueId: 1, value: 'M' },
            { option: 'Color', valueId: 2, value: 'Black' },
        ]))).toBe('Size: M · Color: Black');
    });

    it('falls back to the bare value when the option has no name', () => {
        expect(variantLabelOf(variant([{ option: null, valueId: 1, value: 'M' }]))).toBe('M');
    });

    it('is null for a variant without options or no variant at all', () => {
        expect(variantLabelOf(variant([]))).toBeNull();
        expect(variantLabelOf(undefined)).toBeNull();
    });
});
