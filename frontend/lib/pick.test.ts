import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../types/shop';
import { filterPicksByBreed, formatPickDate, humanizeSlug, pickBreeds, pickCtaLabel, pickPriceParts, relatedPicks, type PickProduct } from './pick';

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

describe('the Picks list helpers', () => {
    const withBreeds = (slug: string, breeds: string[]) => ({ slug, pick: pick({ bestForBreeds: breeds }) }) as unknown as PickProduct;
    const picks = [
        withBreeds('bowl', ['pug', 'french-bulldog']),
        withBreeds('harness', ['pug']),
        withBreeds('ramp', []),
    ];

    it('lists each breed once, sorted, across all the Picks', () => {
        expect(pickBreeds(picks)).toEqual(['french-bulldog', 'pug']);
        expect(pickBreeds([])).toEqual([]);
    });

    it('keeps every Pick when no breed is asked for', () => {
        expect(filterPicksByBreed(picks, null).map((p) => p.slug)).toEqual(['bowl', 'harness', 'ramp']);
    });

    it('keeps only the Picks that are best for the breed', () => {
        expect(filterPicksByBreed(picks, 'pug').map((p) => p.slug)).toEqual(['bowl', 'harness']);
        expect(filterPicksByBreed(picks, 'french-bulldog').map((p) => p.slug)).toEqual(['bowl']);
    });

    it('answers an unknown breed with no Picks rather than all of them', () => {
        expect(filterPicksByBreed(picks, 'not-a-breed')).toEqual([]);
    });
});

describe('relatedPicks', () => {
    // The API sends "id" and no "productId" (the Product type still declares one), so fixtures carry only "id".
    const apiPick = (id: number, breeds: string[] = []) => ({ id, slug: `pick-${id}`, pick: pick({ bestForBreeds: breeds }) }) as unknown as PickProduct;
    const ordinary = { id: 99, slug: 'not-a-pick', pick: null } as unknown as PickProduct;

    it('lists other Picks even though the API sends no productId (the section used to come out empty)', () => {
        const related = relatedPicks([apiPick(1), apiPick(2), apiPick(3)], 1);

        expect(related.map((p) => p.slug)).toEqual(['pick-2', 'pick-3']);
    });

    it('leaves out the Pick being viewed and anything that is not a Pick', () => {
        const related = relatedPicks([apiPick(1), ordinary, apiPick(2)], 2);

        expect(related.map((p) => p.slug)).toEqual(['pick-1']);
    });

    it('shows at most three', () => {
        const related = relatedPicks([apiPick(1), apiPick(2), apiPick(3), apiPick(4), apiPick(5)], 1);

        expect(related).toHaveLength(3);
    });

    it('puts Picks for the same breed first', () => {
        const related = relatedPicks(
            [apiPick(1, ['pug']), apiPick(2, ['corgi']), apiPick(3, ['pug']), apiPick(4, ['corgi']), apiPick(5, ['pug'])],
            1,
            ['pug'],
        );

        expect(related.map((p) => p.slug)).toEqual(['pick-3', 'pick-5', 'pick-2']);
    });

    it('returns nothing when the viewed Pick is the only one', () => {
        expect(relatedPicks([apiPick(1)], 1)).toEqual([]);
    });
});

describe('humanizeSlug', () => {
    it('turns a breed slug into a name', () => {
        expect(humanizeSlug('french-bulldog')).toBe('French Bulldog');
        expect(humanizeSlug('pug')).toBe('Pug');
    });
});
