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

const pickProduct = (slug: string, name: string, breeds: string[], overrides: Partial<ProductPick> = {}) => ({
    id: 1, productId: 1, variantId: 1, slug, name, category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 0, reviews: 0,
    image: '/storage/x.png', brand: 'Necoichi', available: false, stockStatus: 'out_of_stock',
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
        <PicksIndex allPicks={[bowl, harness]} breed={null} now={NOW} {...props} />,
    ).replace(/&#x27;/g, "'");

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

    it('has no Need filter yet', () => {
        const html = render();

        expect(html).not.toContain('>Need<');
        expect(html).not.toContain('All needs');
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

    it('keeps the chips in a single scrolling row on a phone, each at least 40px high', () => {
        const html = render();

        expect(html).toContain('overflow-x-auto');
        expect(html).toContain('min-h-[40px]');
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
