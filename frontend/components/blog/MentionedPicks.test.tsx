// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../types/shop';
import { MentionedPicks } from './MentionedPicks';

const NOW = '2026-11-16T12:00:00Z';

const pickProduct = (slug: string, name: string, brand: string, overrides: { priceCheckedDate?: string | null; referencePrice?: number | null } = {}) =>
    ({
        id: 1, productId: 1, variantId: 1, slug, name, category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 0, reviews: 0,
        image: '/storage/x.png', brand, available: false, stockStatus: 'out_of_stock', solutionTags: ['feeding'],
        pick: {
            retailer: 'chewy', retailerName: 'Chewy', goUrl: 'https://api.petposture.com/go/pick/x', referencePrice: overrides.referencePrice ?? 25.99,
            priceCheckedDate: overrides.priceCheckedDate === undefined ? '2026-11-15' : overrides.priceCheckedDate, bestForBreeds: [], bestForNotes: [],
            ourTake: null, problem: null, approach: null, quickSpecs: [], pros: [], cons: [],
        },
    }) as unknown as Product;

const render = (picks: Product[]) =>
    renderToStaticMarkup(<MentionedPicks picks={picks} postTitle="Tilted Bowl vs Slow Feeder" now={NOW} />);

describe('MentionedPicks', () => {
    it('shows the section with each pick: tag, brand, name, retailer price with the checked date, and a link to the pick', () => {
        const html = render([pickProduct('necoichi-bowl', 'Necoichi Tilted Elevated Bowl', 'Necoichi'), pickProduct('slo-bowl', 'Fun Feeder Slo Bowl', 'Outward Hound')]);

        expect(html).toContain('Products mentioned in this guide');
        expect(html).toContain('Tilted Bowl vs Slow Feeder');
        expect(html).toContain('Necoichi Tilted Elevated Bowl');
        expect(html).toContain('Outward Hound');
        expect(html).toContain('Feeding');
        expect(html).toContain('$25.99');
        expect(html).toMatch(/at Chewy · Checked 15 Nov 2026/);
        expect(html).toContain('href="/picks/necoichi-bowl"');
        expect(html).toContain('href="/picks/slo-bowl"');
        expect(html.match(/View pick →/g)).toHaveLength(2);
    });

    it('is left out entirely when the article links no pick', () => {
        expect(render([])).toBe('');
    });

    it('ignores a product that is not a pick', () => {
        const shopProduct = { ...pickProduct('shop-item', 'Shop item', 'X'), pick: null } as unknown as Product;

        expect(render([shopProduct])).toBe('');
    });

    it('keeps the card but drops the price once its check is more than 30 days old, or when it has no date', () => {
        const stale = render([pickProduct('old', 'Old bowl', 'B', { priceCheckedDate: '2026-09-01' })]);
        const undated = render([pickProduct('undated', 'Undated bowl', 'B', { priceCheckedDate: null })]);

        for (const html of [stale, undated]) {
            expect(html).toContain('href="/picks/');
            expect(html).not.toContain('$25.99');
            expect(html).not.toContain('Checked');
        }
    });

    it('has no cart, buy button or retailer link: it only opens the pick page', () => {
        const html = render([pickProduct('necoichi-bowl', 'Necoichi Tilted Elevated Bowl', 'Necoichi')]);

        expect(html).not.toContain('/go/pick');
        expect(html).not.toMatch(/add to cart|buy/i);
        expect(html.match(/<a /g)).toHaveLength(1);
    });
});
