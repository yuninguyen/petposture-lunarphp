// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../../types/shop';
import type { PickProduct } from '../../lib/pick';
import { PicksIndex } from './PicksIndex';

const NOW = new Date('2026-11-16T12:00:00Z');
const DISCLAIMER = "Based on the seller's description and customer reviews — we haven't tested this ourselves.";

const pick: ProductPick = {
    retailer: 'chewy', retailerName: 'Chewy', goUrl: 'https://api.petposture.com/go/pick/x', referencePrice: 25.99,
    priceCheckedDate: '2026-11-15', bestForBreeds: [], bestForNotes: [], ourTake: null, problem: null, approach: null,
    quickSpecs: [], pros: [], cons: ['Porcelain can break'],
};

const pickProduct = (
    slug: string,
    name: string,
    breeds: string[],
    overrides: Partial<ProductPick> = {},
    solutionTags: string[] = [],
) => ({
    id: 1, productId: 1, variantId: 1, slug, name, category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 0, reviews: 0,
    image: '/storage/x.png', brand: 'Necoichi', available: false, stockStatus: 'out_of_stock', solutionTags,
    pick: {
        ...pick,
        bestForBreeds: breeds,
        ourTake: `${DISCLAIMER} Tilted and raised, so a flat face reaches food with less neck bend.`,
        bestForNotes: ['Small, split meals'],
        ...overrides,
    },
}) as unknown as PickProduct;

const bowl = pickProduct('necoichi-bowl', 'Necoichi Bowl', ['french-bulldog', 'pug']);
const harness = pickProduct('puppia-vest', 'Puppia Vest', ['pug']);

// renderToStaticMarkup writes an apostrophe as &#x27;, which would make every sentence below unreadable.
const render = (props: Partial<React.ComponentProps<typeof PicksIndex>> = {}) =>
    renderToStaticMarkup(
        <PicksIndex allPicks={[bowl, harness]} breed={null} solution={null} now={NOW} {...props} />,
    ).replace(/&#x27;/g, "'");

describe('PicksIndex pages', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => pickProduct(`pick-${index + 1}`, `Pick ${index + 1}`, index < 15 ? ['pug'] : ['corgi']));
    const cards = (html: string) => new Set(html.match(/href="\/picks\/pick-\d+"/g)).size;

    it('shows twelve cards on the first page with a pager to the second, and the rest on the second', () => {
        const first = render({ allPicks: twenty });
        const second = render({ allPicks: twenty, page: 2 });

        expect(cards(first)).toBe(12);
        expect(first).toContain('Pick 12');
        expect(first).not.toContain('Pick 13');
        expect(first).toMatch(/Showing <b[^>]*>1–12 of 20<\/b> picks/);
        expect(cards(second)).toBe(8);
        expect(second).toContain('Pick 13');
        expect(second).not.toContain('Pick 12<');
        expect(second).toMatch(/Showing <b[^>]*>13–20 of 20<\/b> picks/);
    });

    it('links the pages with plain links: page 1 has no page parameter, the current page is marked, and previous and next appear where they apply', () => {
        const first = render({ allPicks: twenty });
        const second = render({ allPicks: twenty, page: 2 });

        const pageLink = (html: string, number: number) => html.match(new RegExp(`<a [^>]*aria-label="Page ${number}"[^>]*>`))?.[0] ?? '';

        expect(first).toContain('aria-label="Pagination"');
        expect(pageLink(first, 1)).toContain('href="/picks"');
        expect(pageLink(first, 1)).toContain('aria-current="page"');
        expect(pageLink(first, 2)).toContain('href="/picks?page=2"');
        expect(pageLink(first, 2)).not.toContain('aria-current');
        expect(pageLink(second, 2)).toContain('aria-current="page"');
        expect(first).toMatch(/rel="next"/);
        expect(first).not.toMatch(/rel="prev"/);
        expect(second).toMatch(/rel="prev"/);
        expect(second).not.toMatch(/rel="next"/);
    });

    it('keeps the chosen breed in the page links, and a breed chip starts again from the first page', () => {
        const html = render({ allPicks: twenty, breed: 'pug', page: 2 });

        expect(html).toContain('href="/picks?breed=pug"');
        expect(html).toContain('href="/picks?breed=pug&amp;page=2"');
        expect(html).toContain('href="/picks?breed=corgi"');
        expect(html).not.toContain('breed=corgi&amp;page');
        expect(cards(html)).toBe(3);
        expect(html).toMatch(/Showing <b[^>]*>13–15 of 15<\/b> picks/);
    });

    it('has no pager and the old count when everything fits on one page', () => {
        const html = render({ allPicks: twenty.slice(0, 12) });

        expect(html).not.toContain('aria-label="Pagination"');
        expect(html).toMatch(/Showing <b[^>]*>12 of 12<\/b> picks/);
        expect(render()).not.toContain('aria-label="Pagination"');
    });

    it('shows the last page for a page past the end, and the first for a page that is not a real one', () => {
        expect(cards(render({ allPicks: twenty, page: 99 }))).toBe(8);
        expect(cards(render({ allPicks: twenty, page: 0 }))).toBe(12);
    });

    it('keeps the headings in order on a page of a long list', () => {
        for (const page of [1, 2]) {
            const levels = headingLevels(render({ allPicks: twenty, page }));

            expect(levels[0]).toBe(1);
            levels.slice(1).forEach((level, index) => expect(level, `page ${page}: heading ${index + 2} jumps from h${levels[index]}`).toBeLessThanOrEqual(levels[index] + 1));
        }
    });
});

const headingLevels = (html: string) => [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

describe('PicksIndex heading order', () => {
    it.each([
        ['all Picks', {}],
        ['a breed filter', { breed: 'french-bulldog' }],
        ['a solution filter', { solution: 'feeding' }],
    ])('goes h1, then h2, then h3 without skipping a level for %s', (_label, props) => {
        const levels = headingLevels(render(props as Partial<React.ComponentProps<typeof PicksIndex>>));

        expect(levels[0]).toBe(1);
        expect(levels.filter((level) => level === 1)).toHaveLength(1);
        levels.slice(1).forEach((level, index) => expect(level, `heading ${index + 2} jumps from h${levels[index]}`).toBeLessThanOrEqual(levels[index] + 1));
    });

    it('has the list heading between the h1 and the card titles, and it is only for screen readers', () => {
        const html = render();

        expect(html).toMatch(/<h2 class="sr-only">All Picks<\/h2>/);
        expect(render({ breed: 'french-bulldog' })).toMatch(/<h2 class="sr-only">Matching Picks<\/h2>/);
    });
});

describe('PicksIndex header', () => {
    it('opens with the shape-of-your-dog headline under a PetPosture Picks tag', () => {
        const html = render();

        expect(html).toContain('PetPosture Picks');
        expect(html).toMatch(/<h1[^>]*>Picked for the <em[^>]*>shape of your dog<\/em>,/);
        expect(html).toContain('not just the shelf it sat on.');
    });

    it('has a breadcrumb Home > Picks', () => {
        const html = render();

        expect(html).toContain('aria-label="Breadcrumb"');
        expect(html).toContain('href="/"');
        expect(html).toMatch(/Home<\/a><\/li><li aria-hidden="true">›<\/li><li[^>]*aria-current="page"[^>]*>Picks<\/li>/);
    });

    // In the design the breadcrumb is a full-width grey bar right under the menu, not a line inside the page column,
    // and the current page is bold.
    it('puts the breadcrumb in a full-width grey bar above the header, with the current page in bold', () => {
        const html = render();
        const nav = html.match(/<nav aria-label="Breadcrumb"[^>]*>/)?.[0] ?? '';

        expect(html.startsWith('<nav aria-label="Breadcrumb"')).toBe(true);
        expect(nav).toContain('bg-[#f4f5f6]');
        expect(nav).toContain('border-b');
        expect(html).toMatch(/aria-current="page"[^>]*class="[^"]*font-bold[^"]*"|class="[^"]*font-bold[^"]*"[^>]*aria-current="page"/);
        expect(html.indexOf('<nav aria-label="Breadcrumb"')).toBeLessThan(html.indexOf('<h1'));
    });

    it('keeps the Home link grey, so only the current page stands out in the breadcrumb', () => {
        const home = render().match(/<a [^>]*href="\/"[^>]*>Home<\/a>/)?.[0] ?? '';

        expect(home).toContain('text-[#6b7680]');
    });

    it('says how many Picks there are and when the latest price was checked, from the data', () => {
        expect(render()).toContain('2 picks, checked 15 Nov 2026');
        expect(render({ allPicks: [bowl] })).toContain('1 pick, checked 15 Nov 2026');
    });

    it('says every Pick has downsides only while that is true', () => {
        expect(render()).toContain('Honest downsides on every pick');
        expect(render({ allPicks: [bowl, pickProduct('no-cons', 'No Cons', ['pug'], { cons: [] })] })).not.toContain(
            'Honest downsides on every pick',
        );
    });

    it('says the Picks have not been tested by PetPosture, once, in the header', () => {
        expect(render()).toContain("We haven't tested these ourselves — and we say so");
    });

    it('has no header claims at all when there is nothing to list', () => {
        const html = render({ allPicks: [] });

        expect(html).not.toContain('Honest downsides');
        expect(html).not.toContain('checked 15 Nov');
    });
});

describe('PicksIndex cards', () => {
    it('lists every Pick as a card that opens its own page', () => {
        const html = render();

        expect(html).toContain('href="/picks/necoichi-bowl"');
        expect(html).toContain('href="/picks/puppia-vest"');
        expect(html).toContain('Necoichi Bowl');
        expect(html.match(/View pick/g)).toHaveLength(2);
    });

    it('gives each card a short take without the "not tested" sentence, a Best for line and breed chips', () => {
        const html = render({ allPicks: [bowl] });

        expect(html).toContain('Tilted and raised, so a flat face reaches food with less neck bend.');
        expect(html).not.toContain(DISCLAIMER);
        expect(html).toContain('Best for:');
        expect(html).toContain('Small, split meals');
        expect(html).toContain('>French Bulldog<');
        expect(html).toContain('>Pug<');
    });

    it('collapses a Pick that suits every breed into one "All N breeds" chip', () => {
        const everyone = pickProduct('wax', 'Paw Wax', ['corgi', 'french-bulldog', 'pug']);
        const html = render({ allPicks: [everyone] });

        expect(html).toContain('All 3 breeds');
    });

    it('leaves out the take and the Best for line when they were not entered', () => {
        const bare = pickProduct('bare', 'Bare Pick', ['pug'], { ourTake: null, bestForNotes: [] });
        const html = render({ allPicks: [bare] });

        expect(html).not.toContain('Best for:');
        expect(html).toContain('Bare Pick');
    });

    it('shows no photo block, and no broken image, for a Pick without a photo', () => {
        const noPhoto = { ...bowl, image: '' } as PickProduct;
        const html = render({ allPicks: [noPhoto] });

        expect(html).not.toContain('<img');
        expect(html).not.toContain('src=""');
    });

    it('shows the whole product photo on a card instead of cropping it to fill', () => {
        const html = render({ allPicks: [bowl] });

        expect(html).toContain('object-contain');
        expect(html).not.toContain('object-cover');
    });

    it('shows the retailer price with the date it was checked while the check is recent', () => {
        const html = render({ allPicks: [bowl] });

        expect(html).toContain('$25.99');
        expect(html).toContain('at Chewy');
        expect(html).toContain('Checked 15 Nov 2026 — check current price');
    });

    it('drops the price from a card once its check is more than 30 days old, but keeps the card', () => {
        const html = render({ allPicks: [bowl], now: new Date('2026-12-30T12:00:00Z') });

        expect(html).not.toContain('$25.99');
        expect(html).not.toContain('Checked 15 Nov 2026');
        expect(html).toContain('href="/picks/necoichi-bowl"');
    });

    it('has no sale badge, struck-through price, stock, cart or shop link', () => {
        const html = render();
        const lower = html.toLowerCase();

        expect(html).not.toContain('line-through');
        for (const banned of ['add to cart', 'wishlist', 'in stock', 'out of stock', 'shipping', 'checkout', '22.71', '% off']) {
            expect(lower, banned).not.toContain(banned);
        }
        expect(html).not.toMatch(/href="\/(shop|cart|checkout)/);
    });

    it('does not open the retailer from a card: the only link on a card is to the Pick page', () => {
        const html = render();

        expect(html).not.toContain('api.petposture.com/go');
        expect(html).not.toContain('target="_blank"');
    });
});

describe('PicksIndex filter', () => {
    it('has a Breed row with an "All breeds" chip and one chip per breed, as links', () => {
        const html = render();

        expect(html).toContain('>Breed<');
        expect(html).toContain('href="/picks"');
        expect(html).toContain('href="/picks?breed=french-bulldog"');
        expect(html).toContain('href="/picks?breed=pug"');
        expect(html).toContain('French Bulldog');
    });

    it('has no Solution row while no Pick carries a solution tag, instead of a row with nothing to choose', () => {
        const html = render();

        expect(html).not.toContain('>Solution<');
        expect(html).not.toContain('All solutions');
    });

    it('marks the chip of the breed being shown', () => {
        const html = render({ breed: 'pug' });

        expect(html).toMatch(/aria-current="true"[^>]*>Pug</);
    });

    it('marks "All breeds" when no breed is chosen', () => {
        expect(render()).toMatch(/aria-current="true"[^>]*>All breeds</);
    });

    it('counts what is shown against all the Picks', () => {
        expect(render()).toMatch(/Showing <b[^>]*>2 of 2<\/b> picks/);
        expect(render({ breed: 'french-bulldog' })).toMatch(/Showing <b[^>]*>1 of 2<\/b> picks/);
    });

    it('wraps the chips onto several rows on a phone instead of scrolling sideways, each at least 40px high', () => {
        const html = render();

        expect(html).not.toContain('overflow-x-auto');
        expect(html).not.toContain('flex-nowrap');
        expect(html).toContain('flex-wrap');
        expect(html).toContain('min-h-[40px]');
    });
});

describe('PicksIndex solution filter', () => {
    const walker = pickProduct('walk-harness', 'Walk Harness', ['pug'], {}, ['walking']);
    const feeder = pickProduct('slo-bowl', 'Slo Bowl', ['pug', 'french-bulldog'], {}, ['feeding']);
    const tagged = [walker, feeder];

    it('shows a Solution row under the Breed row, with an "All solutions" chip and one chip per solution, as links', () => {
        const html = render({ allPicks: tagged });

        expect(html).toContain('>Solution<');
        expect(html).toContain('>All solutions<');
        expect(html).toContain('href="/picks?solution=feeding"');
        expect(html).toContain('href="/picks?solution=walking"');
        expect(html.indexOf('>Breed<')).toBeLessThan(html.indexOf('>Solution<'));
    });

    it('marks "All solutions" when no solution is chosen, and the chosen solution otherwise', () => {
        expect(render({ allPicks: tagged })).toMatch(/aria-current="true"[^>]*>All solutions</);
        expect(render({ allPicks: tagged, solution: 'walking' })).toMatch(/aria-current="true"[^>]*>Walking</);
    });

    it('keeps one row when a chip of the other row is chosen', () => {
        const html = render({ allPicks: tagged, breed: 'pug', solution: 'walking' });

        expect(html).toContain('href="/picks?breed=french-bulldog&amp;solution=walking"');
        expect(html).toContain('href="/picks?breed=pug&amp;solution=feeding"');
        expect(html).toContain('href="/picks?breed=pug"');
        expect(html).toContain('href="/picks?solution=walking"');
    });

    it('lists only the Picks of the chosen solution and counts them against all', () => {
        const html = render({ allPicks: tagged, solution: 'feeding' });

        expect(html).toContain('href="/picks/slo-bowl"');
        expect(html).not.toContain('href="/picks/walk-harness"');
        expect(html).toMatch(/Showing <b[^>]*>1 of 2<\/b> picks/);
    });

    it('combines with the breed: a Pick must match both', () => {
        const html = render({ allPicks: tagged, breed: 'french-bulldog', solution: 'feeding' });

        expect(html).toContain('href="/picks/slo-bowl"');
        expect(html).toMatch(/Showing <b[^>]*>1 of 2<\/b> picks/);
        expect(render({ allPicks: tagged, breed: 'french-bulldog', solution: 'walking' })).toMatch(/Showing <b[^>]*>0 of 2<\/b> picks/);
    });

    it('labels a card with its solution, in the corner of the photo', () => {
        const html = render({ allPicks: [walker] });

        expect(html).toMatch(/<span[^>]*text-\[#8f4a1f\][^>]*>Walking<\/span>/);
    });

    it('has no solution label on a card whose Pick is not tagged', () => {
        const html = render({ allPicks: [bowl] });

        expect(html).not.toMatch(/<span[^>]*uppercase[^>]*shadow[^>]*>[A-Za-z]+<\/span>/);
    });

    it('says plainly when no Pick matches the breed and solution together, and offers to clear them', () => {
        const html = render({ allPicks: tagged, breed: 'french-bulldog', solution: 'walking' });

        expect(html).toContain('No Picks match that combination yet.');
        expect(html).toContain('Clear filters');
    });

    it('says so when a solution has no Pick yet', () => {
        const html = render({ allPicks: tagged, solution: 'mobility' });

        expect(html).toContain('No Picks for Mobility yet.');
    });
});

describe('PicksIndex empty states', () => {
    it('says plainly that no Pick is published, without promising one, and points at the guides', () => {
        const html = render({ allPicks: [] });

        expect(html).toContain('No Picks are published right now.');
        expect(html).toContain('href="/dogs"');
        expect(html).toContain('href="/solutions"');
        expect(html.toLowerCase()).not.toContain('coming soon');
        expect(html.toLowerCase()).not.toContain('check back');
        expect(html).not.toContain('aria-current="true"');
    });

    it('says so when a breed has no Pick yet and links back to all of them', () => {
        const html = render({ breed: 'corgi' });

        expect(html).toContain('No Picks for Corgi yet.');
        expect(html).toContain('href="/picks"');
        expect(html).toMatch(/Showing <b[^>]*>0 of 2<\/b> picks/);
    });
});

describe('PicksIndex "How we choose"', () => {
    it('explains the three steps, in the honest wording of the design', () => {
        const html = render();

        expect(html).toContain('How We Choose');
        expect(html).toContain('Every pick has to earn its place.');
        expect(html).toContain('1 · Matched to a body shape first');
        expect(html).toContain('2 · Checked against real reviews');
        expect(html).toContain('3 · Priced and dated, every time');
    });

    it('is not shown when there is nothing to list, so an empty page stays short', () => {
        expect(render({ allPicks: [] })).not.toContain('How We Choose');
    });
});
