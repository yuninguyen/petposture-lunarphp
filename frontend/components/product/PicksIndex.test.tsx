// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductPick } from '../../types/shop';
import type { PickProduct } from '../../lib/pick';
import { PicksIndex } from './PicksIndex';

const pick: ProductPick = {
    retailer: 'chewy', retailerName: 'Chewy', goUrl: 'https://api.petposture.com/go/pick/x', referencePrice: 25.99,
    priceCheckedDate: '2026-11-15', bestForBreeds: [], bestForNotes: [], ourTake: null, problem: null, approach: null,
    quickSpecs: [], pros: [], cons: [],
};

const pickProduct = (slug: string, name: string, breeds: string[]) => ({
    id: 1, productId: 1, variantId: 1, slug, name, category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 0, reviews: 0,
    image: '', brand: 'Necoichi', available: false, stockStatus: 'out_of_stock', pick: { ...pick, bestForBreeds: breeds },
}) as unknown as PickProduct;

const bowl = pickProduct('necoichi-bowl', 'Necoichi Bowl', ['french-bulldog', 'pug']);
const harness = pickProduct('puppia-vest', 'Puppia Vest', ['pug']);

const render = (props: Partial<React.ComponentProps<typeof PicksIndex>> = {}) =>
    renderToStaticMarkup(<PicksIndex picks={[bowl, harness]} breeds={['french-bulldog', 'pug']} breed={null} {...props} />);

describe('PicksIndex', () => {
    it('lists every Pick as a card that opens its own page', () => {
        const html = render();

        expect(html).toContain('PetPosture Picks');
        expect(html).toContain('href="/picks/necoichi-bowl"');
        expect(html).toContain('href="/picks/puppia-vest"');
        expect(html).toContain('Necoichi Bowl');
    });

    it('has a breadcrumb Home > Picks', () => {
        const html = render();

        expect(html).toContain('aria-label="Breadcrumb"');
        expect(html).toContain('href="/"');
    });

    it('offers an "All" chip and one chip per breed that filters the list', () => {
        const html = render();

        expect(html).toContain('href="/picks"');
        expect(html).toContain('href="/picks?breed=french-bulldog"');
        expect(html).toContain('href="/picks?breed=pug"');
        expect(html).toContain('French Bulldog');
    });

    it('marks the chip of the breed being shown', () => {
        const html = render({ picks: [bowl, harness], breed: 'pug' });

        expect(html).toMatch(/aria-current="true"[^>]*>Pug</);
        expect(html).toContain('Showing Picks for Pug');
    });

    it('marks "All" when no breed is chosen', () => {
        expect(render()).toMatch(/aria-current="true"[^>]*>All</);
    });

    it('says plainly that no Pick is published, without promising one, and points at the guides', () => {
        const html = render({ picks: [], breeds: [] });

        expect(html).toContain('No Picks are published right now.');
        expect(html).toContain('href="/dogs"');
        expect(html).toContain('href="/solutions"');
        expect(html.toLowerCase()).not.toContain('coming soon');
        expect(html.toLowerCase()).not.toContain('check back');
        expect(html).not.toContain('aria-current="true"');
    });

    it('says so when a breed has no Pick yet and links back to all of them', () => {
        const html = render({ picks: [], breed: 'corgi' });

        expect(html).toContain('No Picks for Corgi yet.');
        expect(html).toContain('href="/picks"');
    });

    it('has no cart, price, stock or shop link', () => {
        const html = render();
        const lower = html.toLowerCase();

        for (const banned of ['add to cart', 'wishlist', 'in stock', 'out of stock', 'shipping', 'checkout', '$', '22.71', '25.99']) {
            expect(lower, banned).not.toContain(banned);
        }
        expect(html).not.toMatch(/href="\/(shop|cart|checkout)/);
    });
});
