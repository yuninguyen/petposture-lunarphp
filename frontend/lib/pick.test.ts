import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../types/shop';
import { formatPickDate, humanizeSlug, pickCtaLabel, pickPriceParts } from './pick';

const pick = (overrides: Partial<ProductPick> = {}): ProductPick => ({
    retailer: 'chewy',
    retailerName: 'Chewy',
    goUrl: 'https://api.petposture.com/go/pick/necoichi-bowl',
    referencePrice: 49.96,
    priceCheckedDate: '2026-11-14',
    bestForBreeds: [],
    bestForNotes: [],
    ourTake: null,
    problem: null,
    approach: null,
    quickSpecs: [],
    pros: [],
    cons: [],
    ...overrides,
});

describe('pickCtaLabel', () => {
    it('says "Buy on Chewy" for Chewy', () => {
        expect(pickCtaLabel(pick())).toBe('Buy on Chewy');
    });

    it('says "Check Price on Amazon" for Amazon', () => {
        expect(pickCtaLabel(pick({ retailer: 'amazon', retailerName: 'Amazon' }))).toBe('Check Price on Amazon');
    });

    it('names any other retailer from its network name', () => {
        expect(pickCtaLabel(pick({ retailer: 'petco', retailerName: 'Petco' }))).toBe('View on Petco');
    });

    it('falls back to the slug when the network has no name', () => {
        expect(pickCtaLabel(pick({ retailer: 'pet-supplies-plus', retailerName: null }))).toBe('View on Pet Supplies Plus');
    });

    it('never names a store when the retailer is unknown', () => {
        expect(pickCtaLabel(pick({ retailer: null, retailerName: null }))).toBe('View on the retailer site');
    });
});

describe('formatPickDate', () => {
    it('writes the day, short month and year without a timezone shift', () => {
        expect(formatPickDate('2026-11-14')).toBe('14 Nov 2026');
        expect(formatPickDate('2026-01-01')).toBe('1 Jan 2026');
    });
});

describe('pickPriceParts', () => {
    it('labels the price as the retailer price and always carries the date it was checked', () => {
        expect(pickPriceParts(pick())).toEqual({
            label: 'Price at Chewy',
            amount: '$49.96',
            note: 'Checked 14 Nov 2026 — check current price',
        });
    });

    it('shows no price without a checked date', () => {
        expect(pickPriceParts(pick({ priceCheckedDate: null }))).toBeNull();
    });

    it('shows no price without a reference price', () => {
        expect(pickPriceParts(pick({ referencePrice: null }))).toBeNull();
    });

    it('keeps two decimals', () => {
        expect(pickPriceParts(pick({ referencePrice: 50 }))?.amount).toBe('$50.00');
    });

    it('does not name a store it does not know', () => {
        expect(pickPriceParts(pick({ retailer: null, retailerName: null }))?.label).toBe('Retailer price');
    });
});

describe('humanizeSlug', () => {
    it('turns a breed slug into a name', () => {
        expect(humanizeSlug('french-bulldog')).toBe('French Bulldog');
        expect(humanizeSlug('pug')).toBe('Pug');
    });
});
