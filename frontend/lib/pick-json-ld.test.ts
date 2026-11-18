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
    bestForNotes: [],
    ourTake: null,
    problem: null,
    approach: null,
    quickSpecs: [],
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

    it('never claims an offer, a rating, a price or a stock level, and has no review when nothing was written', () => {
        const ld = buildPickJsonLd(SITE, product());
        const json = JSON.stringify(ld);

        for (const key of ['offers', 'aggregateRating', 'review', 'sku', 'gtin', 'availability', 'price']) {
            expect(ld, key).not.toHaveProperty(key);
        }
        expect(json).not.toContain('reviewRating');
        expect(json).not.toContain('InStock');
        expect(json).not.toContain('OutOfStock');
        expect(json).not.toContain('22.71');
        expect(json).not.toContain('25.99');
        expect(json).not.toContain('4.6');
        expect(json).not.toContain('128');
    });

    describe('PetPosture review', () => {
        const written: Partial<ProductPick> = {
            ourTake: "Based on the seller's description and customer reviews — we haven't tested this ourselves.",
            pros: ['Raised design', ' Easy to clean ', ''],
            cons: ['Holds about one cup'],
        };
        const withPick = (changes: Partial<ProductPick>) => product({ pick: { ...pick, ...changes } } as Partial<Product>);

        it('is the take as the body with pros and cons as notes, written by PetPosture on the date the price was checked', () => {
            const ld = buildPickJsonLd(SITE, withPick(written));

            expect(ld.review).toEqual({
                '@type': 'Review',
                name: "PetPosture's take on Necoichi Tilted Elevated Bowl",
                author: { '@type': 'Organization', name: 'PetPosture' },
                datePublished: '2026-11-15',
                reviewBody: "Based on the seller's description and customer reviews — we haven't tested this ourselves.",
                positiveNotes: {
                    '@type': 'ItemList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Raised design' },
                        { '@type': 'ListItem', position: 2, name: 'Easy to clean' },
                    ],
                },
                negativeNotes: {
                    '@type': 'ItemList',
                    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Holds about one cup' }],
                },
            });
        });

        it('never carries a rating, an offer or a price, with or without a review', () => {
            const ld = buildPickJsonLd(SITE, withPick(written));
            const json = JSON.stringify(ld);

            for (const key of ['offers', 'aggregateRating']) expect(ld, key).not.toHaveProperty(key);
            expect(json).not.toContain('reviewRating');
            expect(json).not.toContain('ratingValue');
            expect(json).not.toContain('25.99');
        });

        it('leaves out the date when the price has no checked date', () => {
            const ld = buildPickJsonLd(SITE, withPick({ ...written, priceCheckedDate: null }));

            expect(ld.review).not.toHaveProperty('datePublished');
        });

        it('drops the notes below two statements but keeps a written take', () => {
            const ld = buildPickJsonLd(SITE, withPick({ ourTake: 'A short take.', pros: ['Only one note'], cons: [] }));

            expect(ld.review).toMatchObject({ reviewBody: 'A short take.' });
            expect(ld.review).not.toHaveProperty('positiveNotes');
            expect(ld.review).not.toHaveProperty('negativeNotes');
        });

        it('works from the notes alone, and leaves out an empty side', () => {
            const ld = buildPickJsonLd(SITE, withPick({ ourTake: null, pros: ['One', 'Two'], cons: [] }));

            expect(ld.review).not.toHaveProperty('reviewBody');
            expect(ld.review).toHaveProperty('positiveNotes');
            expect(ld.review).not.toHaveProperty('negativeNotes');
        });

        it('is left out when there is no take and fewer than two notes', () => {
            expect(buildPickJsonLd(SITE, withPick({ ourTake: '  ', pros: ['Only one'], cons: [] }))).not.toHaveProperty('review');
        });

        it('keeps text typed in the admin from closing the script early', () => {
            const html = serializeJsonLd(buildPickJsonLd(SITE, withPick({ ...written, ourTake: 'Nice </script><b>bowl</b>' })));

            expect(html).not.toContain('</script>');
            expect(html).toContain('\\u003c/script>');
        });
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
    it('goes Home, then the Picks list, then the Pick, without a shop step', () => {
        const ld = buildPickBreadcrumbJsonLd(SITE, product());

        expect(ld['@type']).toBe('BreadcrumbList');
        expect(ld.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://petposture.com/' },
            { '@type': 'ListItem', position: 2, name: 'Picks', item: 'https://petposture.com/picks' },
            { '@type': 'ListItem', position: 3, name: 'Necoichi Tilted Elevated Bowl', item: 'https://petposture.com/picks/necoichi-bowl' },
        ]);
        expect(JSON.stringify(ld)).not.toContain('/shop');
    });
});

describe('serializeJsonLd', () => {
    it('cannot be closed early by text typed in the admin', () => {
        const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });

        expect(json).not.toContain('</script>');
        expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>');
    });
});
