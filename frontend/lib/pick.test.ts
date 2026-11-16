import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../types/shop';
import {
    filterPicksByBreed,
    filterPicksBySolution,
    formatPickDate,
    humanizeSlug,
    isPickPriceFresh,
    pickBreeds,
    pickCardPrice,
    pickCtaLabel,
    pickListStats,
    pickPriceParts,
    pickSolutions,
    pickTakeSummary,
    picksHref,
    relatedPicks,
    type PickProduct,
} from './pick';

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

describe('the solution filter helpers', () => {
    const tagged = (slug: string, tags?: string[]) => ({ slug, solutionTags: tags, pick: pick() }) as unknown as PickProduct;
    const picks = [tagged('harness', ['walking']), tagged('bowl', ['feeding']), tagged('mat', ['comfort', 'feeding']), tagged('untagged', []), tagged('missing')];

    it('lists the solutions in use once each, in the order of the site, with others after, alphabetically', () => {
        const mixed = [tagged('a', ['walking', 'zeta']), tagged('b', ['feeding', 'alpha']), tagged('c', ['comfort'])];

        expect(pickSolutions(mixed)).toEqual(['feeding', 'comfort', 'walking', 'alpha', 'zeta']);
    });

    it('has no solutions when no Pick carries a tag', () => {
        expect(pickSolutions([tagged('x', []), tagged('y')])).toEqual([]);
        expect(pickSolutions([])).toEqual([]);
    });

    it('keeps every Pick when no solution is asked for', () => {
        expect(filterPicksBySolution(picks, null).map((p) => p.slug)).toEqual(['harness', 'bowl', 'mat', 'untagged', 'missing']);
    });

    it('keeps only the Picks tagged with the solution, whatever else they are tagged with', () => {
        expect(filterPicksBySolution(picks, 'feeding').map((p) => p.slug)).toEqual(['bowl', 'mat']);
        expect(filterPicksBySolution(picks, 'walking').map((p) => p.slug)).toEqual(['harness']);
    });

    it('answers an unknown solution with no Picks rather than all of them', () => {
        expect(filterPicksBySolution(picks, 'not-a-solution')).toEqual([]);
    });
});

describe('picksHref', () => {
    it('links to the whole list when nothing is chosen', () => {
        expect(picksHref({ breed: null, solution: null })).toBe('/picks');
    });

    it('carries one filter or both, so choosing a chip in one row keeps the other row', () => {
        expect(picksHref({ breed: 'pug', solution: null })).toBe('/picks?breed=pug');
        expect(picksHref({ breed: null, solution: 'walking' })).toBe('/picks?solution=walking');
        expect(picksHref({ breed: 'french-bulldog', solution: 'feeding' })).toBe('/picks?breed=french-bulldog&solution=feeding');
    });
});

describe('a price on a list card goes away once its check date is more than 30 days old', () => {
    const now = new Date('2026-12-14T12:00:00Z');

    it('keeps the price for a check up to 30 days ago', () => {
        expect(isPickPriceFresh(pick({ priceCheckedDate: '2026-11-15' }), now)).toBe(true);
        expect(isPickPriceFresh(pick({ priceCheckedDate: '2026-11-14' }), now)).toBe(true);
    });

    it('drops it from the 31st day', () => {
        expect(isPickPriceFresh(pick({ priceCheckedDate: '2026-11-13' }), now)).toBe(false);
        expect(isPickPriceFresh(pick({ priceCheckedDate: '2025-01-01' }), now)).toBe(false);
    });

    it('does not trust a date in the future or a missing one', () => {
        expect(isPickPriceFresh(pick({ priceCheckedDate: '2027-01-01' }), now)).toBe(false);
        expect(isPickPriceFresh(pick({ priceCheckedDate: null }), now)).toBe(false);
    });

    it('gives the same price parts as the Pick page while fresh, and nothing once stale', () => {
        expect(pickCardPrice(pick({ priceCheckedDate: '2026-11-15' }), now)).toEqual(pickPriceParts(pick({ priceCheckedDate: '2026-11-15' })));
        expect(pickCardPrice(pick({ priceCheckedDate: '2026-11-01' }), now)).toBeNull();
    });

    it('still has no price without a reference price, however fresh the date', () => {
        expect(pickCardPrice(pick({ referencePrice: null, priceCheckedDate: '2026-12-01' }), now)).toBeNull();
    });
});

describe('pickTakeSummary', () => {
    it('drops the "we have not tested this" sentence, which the page header already says, and keeps the take', () => {
        const text = "Based on the seller's description and customer reviews — we haven't tested this ourselves. A simple front-clip harness that gently steers a dog.";

        expect(pickTakeSummary(text)).toBe('A simple front-clip harness that gently steers a dog.');
    });

    it('recognises the same sentence typed with a curly apostrophe', () => {
        const text = 'Based on the seller’s description and customer reviews — we haven’t tested this ourselves. A snuffle mat.';

        expect(pickTakeSummary(text)).toBe('A snuffle mat.');
    });

    it('keeps several sentences when they fit', () => {
        expect(pickTakeSummary('One. Two.')).toBe('One. Two.');
    });

    it('is null when nothing is left or nothing was written', () => {
        expect(pickTakeSummary("Based on the seller's description — we haven't tested this ourselves.")).toBeNull();
        expect(pickTakeSummary('')).toBeNull();
        expect(pickTakeSummary(null)).toBeNull();
    });

    it('cuts a long take at a word boundary with an ellipsis', () => {
        const long = 'Word '.repeat(60).trim();
        const summary = pickTakeSummary(long, 50) as string;

        expect(summary.length).toBeLessThanOrEqual(51);
        expect(summary.endsWith('…')).toBe(true);
        expect(summary).not.toMatch(/Wor…$/);
    });
});

describe('pickListStats', () => {
    const withData = (checked: string | null, cons: string[]) => ({ pick: pick({ priceCheckedDate: checked, cons }) }) as unknown as PickProduct;

    it('counts the Picks and finds the latest check date', () => {
        const stats = pickListStats([withData('2026-11-10', ['x']), withData('2026-11-15', ['x']), withData(null, ['x'])]);

        expect(stats).toEqual({ count: 3, latestChecked: '2026-11-15', everyPickHasCons: true });
    });

    it('says the downsides claim is not true for every Pick when one has none', () => {
        expect(pickListStats([withData('2026-11-10', ['x']), withData('2026-11-10', [])]).everyPickHasCons).toBe(false);
    });

    it('has no date and no downsides claim for an empty list', () => {
        expect(pickListStats([])).toEqual({ count: 0, latestChecked: null, everyPickHasCons: false });
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
