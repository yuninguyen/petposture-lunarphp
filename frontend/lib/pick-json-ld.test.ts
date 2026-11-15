import { describe, expect, it } from 'vitest';
import type { Product, ProductPick } from '../types/shop';
import { buildPickBreadcrumbJsonLd, buildPickJsonLd, serializeJsonLd } from './pick-json-ld';

const SITE = 'https://petposture.com';

const pick: ProductPick = {
    retailer: 'chewy',
    retailerName: 'Chewy',
    goUrl: 'https://api.petposture.com/go/pick/necoichi-bowl',
    referencePrice: 25.99,
    priceCheckedDate: '2026-11-15',
    bestForBreeds: ['french-bulldog'],
    pros: [],
    cons: [],
};

const product = (overrides: Partial<Product> = {}) => ({
    id: 2, productId: 2, variantId: 3, slug: 'necoichi-bowl', name: 'Necoichi Tilted Elevated Bowl',
    category: 'Bowls', categorySlug: 'bowls', price: 22.71, rating: 4.6, reviews: 128, brand: 'Necoichi',
    description: '<p>A raised, <b>tilted</b> bowl.</p>', image: 'https://api.petposture.com/storage/bowl.webp',
    available: false, stockStatus: 'out_of_stock', pick, ...overrides,
}) as Product & { pick: ProductPick };

describe('buildPickJsonLd', () => {
    it('describes the Pick as a Product at its own /picks address', () => {
        const ld = buildPickJsonLd(SITE, product());

        expect(ld['@context']).toBe('https://schema.org');
        expect(ld['@type']).toBe('Product');
        expect(ld.name).toBe('Necoichi Tilted Elevated Bowl');
        expect(ld.url).toBe('https://petposture.com/picks/necoichi-bowl');
        expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Necoichi' });
        expect(ld.image).toBe('https://api.petposture.com/storage/bowl.webp');
        expect(ld.description).toBe('A raised, tilted bowl.');
    });

    it('never claims an offer, a rating, a review, a price or a stock level', () => {
        const ld = buildPickJsonLd(SITE, product());
        const json = JSON.stringify(ld);

        for (const key of ['offers', 'aggregateRating', 'review', 'sku', 'gtin', 'availability', 'price']) {
            expect(ld, key).not.toHaveProperty(key);
        }
        expect(json).not.toContain('InStock');
        expect(json).not.toContain('OutOfStock');
        expect(json).not.toContain('22.71');
        expect(json).not.toContain('25.99');
        expect(json).not.toContain('4.6');
        expect(json).not.toContain('128');
    });

    it('does not point at the hidden shop', () => {
        expect(JSON.stringify(buildPickJsonLd(SITE, product()))).not.toContain('/shop');
    });

    it('leaves out the fields a Pick does not have', () => {
        const ld = buildPickJsonLd(SITE, product({ brand: undefined, description: '', image: '' } as Partial<Product>));

        expect(ld).not.toHaveProperty('brand');
        expect(ld).not.toHaveProperty('description');
        expect(ld).not.toHaveProperty('image');
    });

    it('uses the first gallery image when there is one', () => {
        const ld = buildPickJsonLd(SITE, product({ images: [{ id: 1, src: 'https://api.petposture.com/storage/first.webp' }] }));

        expect(ld.image).toBe('https://api.petposture.com/storage/first.webp');
    });
});

describe('buildPickBreadcrumbJsonLd', () => {
    it('goes Home then the Pick, without a shop step', () => {
        const ld = buildPickBreadcrumbJsonLd(SITE, product());

        expect(ld['@type']).toBe('BreadcrumbList');
        expect(ld.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://petposture.com/' },
            { '@type': 'ListItem', position: 2, name: 'Necoichi Tilted Elevated Bowl', item: 'https://petposture.com/picks/necoichi-bowl' },
        ]);
    });
});

describe('serializeJsonLd', () => {
    it('cannot be closed early by text typed in the admin', () => {
        const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });

        expect(json).not.toContain('</script>');
        expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>');
    });
});
