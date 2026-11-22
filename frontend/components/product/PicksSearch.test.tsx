// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PICK_SORTS, type PickProduct } from '../../lib/pick';
import { PicksIndex } from './PicksIndex';

const NOW = new Date('2026-11-16T12:00:00Z');

const pickProduct = (slug: string, name: string, breeds: string[]) =>
    ({
        id: 1, productId: 1, variantId: 1, slug, name, category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 0, reviews: 0,
        image: '/storage/x.png', brand: 'Necoichi', available: false, stockStatus: 'out_of_stock', solutionTags: [],
        pick: {
            retailer: 'chewy', retailerName: 'Chewy', goUrl: 'https://api.petposture.com/go/pick/x', referencePrice: 25.99,
            priceCheckedDate: '2026-11-15', bestForBreeds: breeds, bestForNotes: [], ourTake: null, problem: null, approach: null,
            quickSpecs: [], pros: [], cons: ['Porcelain can break'],
        },
    }) as unknown as PickProduct;

const many = Array.from({ length: 20 }, (_, index) =>
    pickProduct(`pick-${index + 1}`, index < 14 ? `Raised Bowl ${index + 1}` : `Harness ${index + 1}`, ['pug']),
);
const render = (props: Partial<React.ComponentProps<typeof PicksIndex>> = {}) =>
    renderToStaticMarkup(<PicksIndex allPicks={many} breed={null} solution={null} now={NOW} {...props} />);
const cards = (html: string) => new Set(html.match(/href="\/picks\/pick-\d+"/g)).size;

describe('PicksIndex search and sort', () => {
    it('has a search box with the placeholder, the Popular chips as links, and a Sort menu with the six choices', () => {
        const html = render();

        expect(html).toContain('placeholder="Search by name or brand…"');
        expect(html).toContain('action="/picks"');
        for (const word of ['rabbitgoo', 'harness', 'bowl', 'feeder']) expect(html).toContain(`href="/picks?q=${word}"`);
        expect(html).toContain('Sort by:');
        expect(html).toContain('aria-label="Sort by: Featured"');
    });

    it('offers exactly the six sorts, and the button shows the one chosen', () => {
        expect(PICK_SORTS.map((option) => option.label)).toEqual(['Featured', 'Price: Low to High', 'Price: High to Low', 'Newest', 'Name A–Z', 'Name Z–A']);
        expect(render({ sort: 'price-desc' })).toContain('aria-label="Sort by: Price: High to Low"');
    });

    it('keeps the sort in the search form, so searching does not lose it', () => {
        expect(render({ sort: 'newest' })).toContain('type="hidden" name="sort" value="newest"');
        expect(render()).not.toContain('name="sort"');
    });

    it('shows only the matches, counts them, and keeps the search words in the box', () => {
        const html = render({ q: 'harness' });

        expect(cards(html)).toBe(6);
        expect(html).toMatch(/Showing <b[^>]*>6 of 20<\/b> picks/);
        expect(html).toContain('value="harness"');
    });

    it('combines search with the page, and the chips and pager keep the search and the sort', () => {
        const html = render({ q: 'bowl', sort: 'name-asc', page: 2 });

        expect(cards(html)).toBe(2);
        expect(html).toMatch(/Showing <b[^>]*>13–14 of 14<\/b> picks/);
        expect(html).toContain('href="/picks?q=bowl&amp;sort=name-asc"');
        expect(html).toContain('href="/picks?breed=pug&amp;q=bowl&amp;sort=name-asc"');
    });

    it('keeps the chosen breed as a hidden field so a new search keeps it, and sends no page so it starts at page 1', () => {
        const html = render({ breed: 'pug' });

        expect(html).toContain('type="hidden" name="breed" value="pug"');
        expect(html).not.toContain('name="page"');
    });

    it('orders the cards by the chosen sort', () => {
        const html = render({ allPicks: many.slice(0, 3), sort: 'name-desc' });

        expect(html.indexOf('Raised Bowl 3')).toBeLessThan(html.indexOf('Raised Bowl 2'));
        expect(html.indexOf('Raised Bowl 2')).toBeLessThan(html.indexOf('Raised Bowl 1<'));
    });

    it('says "No picks found" with a way to clear the search when nothing matches', () => {
        const html = render({ q: 'zzz' });

        expect(cards(html)).toBe(0);
        expect(html).toContain('No picks found');
        expect(html).toContain('href="/picks">Clear search');
        expect(html).not.toContain('aria-label="Pagination"');
    });
});
