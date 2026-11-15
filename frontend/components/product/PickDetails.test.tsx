// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Product, ProductPick } from '../../types/shop';
import { PickDetails } from './PickDetails';

const GO_URL = 'https://api.petposture.com/go/pick/necoichi-bowl';

const pickData = (overrides: Partial<ProductPick> = {}): ProductPick => ({
    retailer: 'chewy',
    retailerName: 'Chewy',
    goUrl: GO_URL,
    referencePrice: 49.96,
    priceCheckedDate: '2026-11-14',
    bestForBreeds: ['french-bulldog', 'pug'],
    pros: ['Raised design', 'Easy to clean'],
    cons: ['Holds about one cup'],
    ...overrides,
});

// Stock 0 on purpose: a Pick has no PetPosture stock, so none of it may show on the page.
const product = (pick: ProductPick = pickData(), overrides: Partial<Product> = {}): Product & { pick: ProductPick } => ({
    id: 1,
    productId: 1,
    variantId: 10,
    slug: 'necoichi-bowl',
    name: 'Necoichi Raised Cat Food Bowl',
    category: 'Bowls',
    categorySlug: 'bowls',
    price: 22.71,
    rating: 4.6,
    reviews: 128,
    image: '/storage/bowl.png',
    brand: 'Necoichi',
    description: '<p>A raised, tilted bowl.</p>',
    specs: [{ label: 'Material', value: 'Ceramic' }],
    available: false,
    stockStatus: 'out_of_stock',
    pick,
    ...overrides,
} as Product & { pick: ProductPick });

const related = (slug: string, name: string): Product => ({
    id: 2, productId: 2, variantId: 20, slug, name, category: 'Bowls', categorySlug: 'bowls',
    price: 10, rating: 0, reviews: 0, image: `/storage/${slug}.png`, pick: pickData({ goUrl: `https://api.petposture.com/go/pick/${slug}` }),
} as Product);

const render = (p = product(), others: Product[] = []) => renderToStaticMarkup(<PickDetails product={p} related={others} />);

describe('PickDetails', () => {
    it('has no cart, stock, shipping, returns or payment text, even when the variant stock is 0', () => {
        const html = render().toLowerCase();

        for (const banned of [
            'add to cart', 'add to bag', 'buy now', 'quantity', 'in stock', 'out of stock', 'out_of_stock',
            'shipping', 'returns', 'guarantee', 'free express', 'next-day', '30-day', 'checkout', 'payment',
        ]) {
            expect(html, banned).not.toContain(banned);
        }
    });

    it('does not link into the shop, the cart or the checkout', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl')]);

        expect(html).not.toMatch(/href="\/(shop|cart|checkout)/);
    });

    it('has exactly one primary button, opening the tracked link in a new tab with the affiliate rel', () => {
        const html = render();
        const anchors = html.match(/<a [^>]*rel="sponsored nofollow noopener"[^>]*>[^<]*<\/a>/g) ?? [];

        expect(anchors).toHaveLength(1);
        expect(anchors[0]).toContain(`href="${GO_URL}"`);
        expect(anchors[0]).toContain('target="_blank"');
        expect(anchors[0]).toContain('>Buy on Chewy<');
        expect(html).not.toContain('noreferrer');
    });

    it('names Amazon on the button when the retailer is Amazon', () => {
        const html = render(product(pickData({ retailer: 'amazon', retailerName: 'Amazon' })));

        expect(html).toContain('>Check Price on Amazon<');
    });

    it('shows the price only as the retailer reference price with its checked date', () => {
        const html = render();

        expect(html).toContain('Price on Chewy: $49.96 (checked 14 Nov 2026) — check current price');
        expect(html).not.toContain('22.71');
    });

    it('shows no price at all without a checked date', () => {
        const html = render(product(pickData({ priceCheckedDate: null, referencePrice: null })));

        expect(html).not.toContain('$');
        expect(html).not.toContain('49.96');
        expect(html).not.toContain('22.71');
    });

    it('puts the affiliate disclosure right after the button', () => {
        const html = render();
        const disclosure = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';
        const button = html.indexOf('>Buy on Chewy<');

        expect(html).toContain(disclosure);
        expect(html.indexOf(disclosure) - button).toBeGreaterThan(0);
        expect(html.indexOf(disclosure) - button).toBeLessThan(400);
    });

    it('does not present the site rating or review count as a retailer rating', () => {
        const html = render();

        expect(html).not.toContain('4.6');
        expect(html).not.toContain('128');
        expect(html.toLowerCase()).not.toContain('verified');
        expect(html).not.toContain('AggregateRating');
    });

    it('lists the pros and the honest cons', () => {
        const html = render();

        expect(html).toContain('Raised design');
        expect(html).toContain('Easy to clean');
        expect(html).toContain('Holds about one cup');
    });

    it('omits the cons block when there are none instead of showing an empty heading', () => {
        const html = render(product(pickData({ cons: [] })));

        expect(html.toLowerCase()).not.toContain('cons');
    });

    it('links each best-for breed to its guide', () => {
        const html = render();

        expect(html).toContain('href="/dogs/french-bulldog"');
        expect(html).toContain('French Bulldog');
        expect(html).toContain('href="/dogs/pug"');
    });

    it('shows the specs and the description that were entered in the admin, and nothing more', () => {
        const html = render();

        expect(html).toContain('Material');
        expect(html).toContain('Ceramic');
        expect(html).toContain('A raised, tilted bowl.');
    });

    it('links related Picks to their own pages, not to the shop', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl'), related('puppia-vest', 'Puppia Vest')]);

        expect(html).toContain('href="/picks/slo-bowl"');
        expect(html).toContain('href="/picks/puppia-vest"');
    });

    it('renders no image, not a broken one, when the Pick has no photo yet', () => {
        const withoutPhoto = product(pickData(), { image: null, images: [] } as unknown as Partial<Product>);
        const html = render(withoutPhoto);

        expect(html).not.toContain('<img');
        expect(html).not.toContain('src=""');
        expect(html).toContain('>Buy on Chewy<');
    });

    it('has no related section when there are no other Picks', () => {
        expect(render().toLowerCase()).not.toContain('more picks');
    });
});
