import { describe, expect, it } from 'vitest';
import type { ProductVariant } from '../types/shop';
import { choiceState, selectionOf, variantFor } from './variantSelection';

const variant = (id: number, size: number, color: number, available = true): ProductVariant => ({
    id, sku: null, price: 10, stock: available ? 3 : 0, available,
    options: [{ option: 'Size', valueId: size, value: `s${size}` }, { option: 'Color', valueId: color, value: `c${color}` }],
});

// Size 1/2 × Color 7/8: (2, 8) is not offered, (1, 8) is sold out.
const variants = [variant(10, 1, 7), variant(11, 1, 8, false), variant(12, 2, 7)];

describe('variantSelection', () => {
    it('reads the selection of a variant and finds the variant of a selection', () => {
        expect(selectionOf(variants[0])).toEqual({ Size: 1, Color: 7 });
        expect(selectionOf(null)).toEqual({});
        expect(variantFor(variants, { Size: 2, Color: 7 })?.id).toBe(12);
        expect(variantFor(variants, { Size: 2, Color: 8 })).toBeUndefined();
    });

    it('tells available, sold out and not offered choices apart', () => {
        const selection = { Size: 1, Color: 7 };

        expect(choiceState(variants, selection, 'Color', 7)).toBe('available');
        expect(choiceState(variants, selection, 'Color', 8)).toBe('sold_out');
        expect(choiceState(variants, selection, 'Size', 2)).toBe('available');
        expect(choiceState(variants, { Size: 2, Color: 7 }, 'Color', 8)).toBe('not_offered');
    });
});
