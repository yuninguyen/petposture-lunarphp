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
    pickSecondCtaLabel,
    pickLowerPrice,
    pickPriceRows,
    pickVariantLine,
    pickListStats,
    pickPriceParts,
    pickSeoTitle,
    PICK_TITLE_MAX,
    PICKS_PER_PAGE,
    paginatePicks,
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

    it('says "Buy on Amazon" for Amazon', () => {
        expect(pickCtaLabel(pick({ retailer: 'amazon', retailerName: 'Amazon' }))).toBe('Buy on Amazon');
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

    it('says "Buy on PetSmart" for PetSmart', () => {
        expect(pickCtaLabel(pick({ retailer: 'petsmart', retailerName: 'PetSmart' }))).toBe('Buy on PetSmart');
    });
});

describe('pickSecondCtaLabel', () => {
    it('names the second store from its network, the same way as the first button does', () => {
        expect(pickSecondCtaLabel({ retailer: 'petsmart', retailerName: 'PetSmart', goUrl: 'https://petposture.com/go/pick/x?retailer=second' })).toBe('Buy on PetSmart');
        expect(pickSecondCtaLabel({ retailer: 'chewy', retailerName: 'Chewy', goUrl: '/go' })).toBe('Buy on Chewy');
        expect(pickSecondCtaLabel({ retailer: 'amazon', retailerName: 'Amazon', goUrl: '/go' })).toBe('Buy on Amazon');
        expect(pickSecondCtaLabel({ retailer: 'petco', retailerName: 'Petco', goUrl: '/go' })).toBe('View on Petco');
    });
});

describe('the price table', () => {
    const second = (price: number | null, priceCheckedDate: string | null) => ({ retailer: 'petsmart', retailerName: 'PetSmart', goUrl: '/go?retailer=second', price, priceCheckedDate });
    const now = new Date('2026-11-21T12:00:00Z');
    const lower = (chewy: number, petsmart: number, chewyDate = '2026-11-21', petsmartDate = '2026-11-21') =>
        pickLowerPrice(pickPriceRows(pick({ referencePrice: chewy, priceCheckedDate: chewyDate, secondRetailer: second(petsmart, petsmartDate) }), null, false), now);

    it('has one row for one store and two, Chewy first, with a second store', () => {
        expect(pickPriceRows(pick(), null, false).map((row) => row.slot)).toEqual(['first']);
        expect(pickPriceRows(pick({ secondRetailer: second(40.99, '2026-11-21') }), null, false).map((row) => [row.slot, row.name, row.price, row.checked])).toEqual([
            ['first', 'Chewy', '$49.96', '14 Nov 2026'],
            ['second', 'PetSmart', '$40.99', '21 Nov 2026'],
        ]);
    });

    it('names the main store from the Pick\'s own retailer, not Chewy: an Amazon Pick has an Amazon first row with its logo', () => {
        const [first, ...rest] = pickPriceRows(pick({ retailer: 'amazon', retailerName: 'Amazon', goUrl: '/go/pick/rabbitgoo', referencePrice: 39.99, priceCheckedDate: '2026-11-21' }), null, false);

        expect(rest).toEqual([]);
        expect(first).toMatchObject({
            slot: 'first',
            name: 'Amazon',
            logo: { src: '/images/retailers/amazon.png', width: 398, height: 120 },
            price: '$39.99',
            checked: '21 Nov 2026',
            goUrl: '/go/pick/rabbitgoo',
            buttonLabel: 'Buy',
            ariaLabel: 'Buy on Amazon',
        });
        // a Chewy Pick keeps the Chewy logo and the Buy wording
        expect(pickPriceRows(pick(), null, false)[0]).toMatchObject({ name: 'Chewy', logo: { src: '/images/retailers/chewy.png' }, buttonLabel: 'Buy' });
    });

    it('gives every store the same short "Buy" on its button: a longer word spills out of the fixed 104px column', () => {
        for (const retailer of ['chewy', 'petsmart', 'amazon', 'walmart', 'petco', 'pet-supplies-plus']) {
            const [row] = pickPriceRows(pick({ retailer, retailerName: null }), null, false);

            expect(row.buttonLabel, retailer).toBe('Buy');
            expect(row.buttonLabel.length).toBeLessThanOrEqual(3);
        }
    });

    it('finds each store\'s logo by its slug whatever the case, and names a store with no logo in text', () => {
        expect(pickPriceRows(pick({ retailer: 'Amazon', retailerName: null }), null, false)[0]).toMatchObject({ name: 'Amazon', logo: { src: '/images/retailers/amazon.png' } });
        expect(pickPriceRows(pick({ retailer: 'zooplus', retailerName: 'Zooplus' }), null, false)[0]).toMatchObject({ name: 'Zooplus', logo: null });
    });

    it('takes Amazon as the second store too, with its own price and the same short Buy button', () => {
        const rows = pickPriceRows(pick({ secondRetailer: { retailer: 'amazon', retailerName: 'Amazon', goUrl: '/go?retailer=second', price: 40.99, priceCheckedDate: '2026-11-21' } }), null, false);

        expect(rows.map((row) => [row.slot, row.name, row.price, row.buttonLabel])).toEqual([
            ['first', 'Chewy', '$49.96', 'Buy'],
            ['second', 'Amazon', '$40.99', 'Buy'],
        ]);
        expect(rows[1].logo?.src).toBe('/images/retailers/amazon.png');
    });

    it('shows a price only with its date, and the first store follows the chosen variant', () => {
        expect(pickPriceRows(pick({ priceCheckedDate: null }), null, false)[0].price).toBeNull();
        const variant = { id: 2, label: 'Black', options: [], referencePrice: 52, goUrl: '/go?variant=2' };
        const [first] = pickPriceRows(pick(), variant, true);

        expect(first.price).toBe('$52.00');
        expect(first.goUrl).toBe('/go?variant=2');
    });

    it('has no second row until the second store has both its price and its check date', () => {
        for (const [price, date] of [[null, null], [40.99, null], [null, '2026-11-21']] as const) {
            const rows = pickPriceRows(pick({ secondRetailer: second(price, date) }), null, false);

            expect(rows.map((row) => row.slot), `${price} ${date}`).toEqual(['first']);
        }
        // an API that predates the price fields (no price, no date at all) is the same as none entered
        expect(pickPriceRows(pick({ secondRetailer: { retailer: 'petsmart', retailerName: 'PetSmart', goUrl: '/go?retailer=second' } }), null, false)).toHaveLength(1);
        // and with a variant chooser the row still needs them, then keeps only its button
        const variant = { id: 1, label: 'Camo', options: [], referencePrice: 45.95, goUrl: '/go?variant=1' };
        expect(pickPriceRows(pick({ secondRetailer: second(null, null) }), variant, true)).toHaveLength(1);
        expect(pickPriceRows(pick({ secondRetailer: second(40.99, '2026-11-21') }), variant, true)).toHaveLength(2);
    });

    it('gives the second store no price while the reader can choose between variants', () => {
        const variant = { id: 1, label: 'Camo', options: [], referencePrice: 45.95, goUrl: '/go?variant=1' };
        const rows = pickPriceRows(pick({ secondRetailer: second(40.99, '2026-11-21') }), variant, true);

        expect(rows[1].price).toBeNull();
        expect(rows[1].goUrl).toBe('/go?retailer=second');
        expect(pickLowerPrice(rows, now)).toBeNull();
    });

    it('names the cheaper store and the saving in dollars and cents', () => {
        expect(lower(64.99, 40.99)).toEqual({ slot: 'second', save: '$24.00' });
        expect(lower(20, 25.5)).toEqual({ slot: 'first', save: '$5.50' });
        expect(lower(30, 29)).toEqual({ slot: 'second', save: '$1.00' });
    });

    it('stays silent under a dollar and at equal prices', () => {
        expect(lower(18.4, 18.39)).toBeNull();
        expect(lower(19.43, 19.43)).toBeNull();
        expect(lower(29.99, 29.0)).toBeNull();
    });

    it('counts in cents, so float noise cannot hide a saving of exactly one dollar', () => {
        // 10.1 + 0.2 is 10.299999999999999, and minus 9.3 is a hair under 1 when subtracted as floats
        expect(lower(10.1 + 0.2, 9.3)).toEqual({ slot: 'second', save: '$1.00' });
    });

    it('stays silent when either check is more than 30 days old, and says it when it is exactly 30', () => {
        expect(lower(64.99, 40.99, '2026-10-01')).toBeNull();
        expect(lower(64.99, 40.99, '2026-11-21', '2026-10-01')).toBeNull();
        expect(lower(64.99, 40.99, '2026-10-22')).toEqual({ slot: 'second', save: '$24.00' });
        expect(lower(64.99, 40.99, '2026-10-21')).toBeNull();
        expect(lower(64.99, 40.99, '2026-11-22')).toBeNull();
    });

    it('has no comparison for a single store', () => {
        expect(pickLowerPrice(pickPriceRows(pick(), null, false), now)).toBeNull();
    });

    it('reads the product from the colour and size of the quick specs', () => {
        const specs = (...pairs: [string, string][]) => pick({ quickSpecs: pairs.map(([label, value]) => ({ label, value })) });

        expect(pickVariantLine(specs(['Color', 'Mist Gray'], ['Size', 'Large']))).toBe('Mist Gray · Large');
        expect(pickVariantLine(specs(['Size', 'Large'], ['Colour', 'Black']))).toBe('Black · Large');
        expect(pickVariantLine(specs(['Color', 'Black'], ['Size', 'Medium: 24 to 34-in chest']))).toBe('Black · Medium');
        expect(pickVariantLine(specs(['Size', 'Medium — 3.5 in wide x 3 in high']))).toBe('Medium');
        expect(pickVariantLine(specs(['Size', '12 to 17-in chest']))).toBe('12 to 17-in chest');
        expect(pickVariantLine(specs(['Material', 'Nylon']))).toBeNull();
        expect(pickVariantLine(pick())).toBeNull();
    });
});

describe('Picks list pages', () => {
    const items = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

    it('shows twelve Picks on a page', () => {
        expect(PICKS_PER_PAGE).toBe(12);
    });

    it('puts twelve on the first page and the other eight of twenty on the second', () => {
        const first = paginatePicks(items(20), 1);
        const second = paginatePicks(items(20), 2);

        expect(first).toMatchObject({ page: 1, pages: 2, total: 20, from: 1, to: 12 });
        expect(first.items).toEqual(items(12));
        expect(second).toMatchObject({ page: 2, pages: 2, total: 20, from: 13, to: 20 });
        expect(second.items).toEqual([13, 14, 15, 16, 17, 18, 19, 20]);
    });

    it('needs a second page only for the thirteenth Pick', () => {
        expect(paginatePicks(items(12), 1).pages).toBe(1);
        expect(paginatePicks(items(13), 1).pages).toBe(2);
        expect(paginatePicks(items(13), 2).items).toEqual([13]);
        expect(paginatePicks([], 1)).toMatchObject({ page: 1, pages: 1, total: 0, from: 0, to: 0, items: [] });
    });

    it('treats a page below 1 or not a number as the first, and one past the end as the last', () => {
        for (const page of [0, -3, Number.NaN, 1.9]) expect(paginatePicks(items(20), page).page, String(page)).toBe(1);
        expect(paginatePicks(items(20), 99)).toMatchObject({ page: 2, from: 13, to: 20 });
    });

    it('writes page 2 and on into the address, never page 1, and keeps the filters', () => {
        expect(picksHref({ breed: null, solution: null, page: 2 })).toBe('/picks?page=2');
        expect(picksHref({ breed: 'pug', solution: 'walking', page: 3 })).toBe('/picks?breed=pug&solution=walking&page=3');
        expect(picksHref({ breed: 'pug', solution: null, page: 1 })).toBe('/picks?breed=pug');
        expect(picksHref({ breed: null, solution: null, page: null })).toBe('/picks');
        expect(picksHref({ breed: null, solution: null })).toBe('/picks');
    });
});

describe('pickSeoTitle', () => {
    const fullTitle = (name: string) => `${pickSeoTitle(name)} | PetPosture`;

    it('leaves a name that already fits the limit exactly as it is', () => {
        for (const name of [
            'KONG Puppy Chew Dog Toy',
            '2 Hounds Design Freedom No Pull Harness, Black, Medium',
            'PetSafe Drinkwell Pagoda Ceramic Dog & Cat Fountain',
            'Outward Hound Hide N\' Slide Puzzle Game Dog Toy',
        ]) {
            expect(pickSeoTitle(name), name).toBe(name);
        }
    });

    it('drops the trailing size details of a long name, one at a time, until the title fits', () => {
        const joyride = 'Joyride Harness Premium Advanced No Pull Dog Harness 2.0, Blue Serenity, X-Small: 12 to 17-in chest';

        expect(pickSeoTitle(joyride)).toBe('Joyride Harness Premium Advanced No Pull Dog Harness 2.0');
        expect(fullTitle(joyride).length).toBeLessThanOrEqual(PICK_TITLE_MAX);
    });

    it('stops at the first detail that makes it fit, keeping the rest', () => {
        expect(pickSeoTitle('Acme Super Comfortable Dog Bed, Charcoal Gray, Extra Large Size')).toBe('Acme Super Comfortable Dog Bed, Charcoal Gray');
    });

    it('cuts a long name with no comma or colon at a word and marks it with an ellipsis', () => {
        const name = 'Extraordinarily Long Product Name Without Any Separators Whatsoever That Keeps Going On';
        const title = pickSeoTitle(name);

        expect(title.endsWith('…')).toBe(true);
        expect(fullTitle(name).length).toBeLessThanOrEqual(PICK_TITLE_MAX);
        expect(name.startsWith(title.slice(0, -1))).toBe(true);
        expect(title.slice(0, -1).endsWith(' ')).toBe(false);
    });

    it('never needs more than the limit for any live Pick name', () => {
        for (const name of [
            'PetSafe Drinkwell Pagoda Ceramic Dog & Cat Fountain',
            'Outward Hound Fun Feeder Slo Bowl, Sage, Small 2-cup',
            'BullHug Adjustable No-Choke Harness, Medium Black',
            'Joyride Harness Premium Advanced No Pull Dog Harness 2.0, Blue Serenity, X-Small: 12 to 17-in chest',
        ]) {
            expect(fullTitle(name).length, name).toBeLessThanOrEqual(PICK_TITLE_MAX);
        }
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
