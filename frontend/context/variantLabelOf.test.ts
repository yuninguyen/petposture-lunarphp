import { describe, expect, it } from 'vitest';
import type { ProductVariant } from '../types/shop';
import { variantLabelOf } from '../lib/variantLabel';

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
