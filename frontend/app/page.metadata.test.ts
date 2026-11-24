import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/HomePage', () => ({ default: () => null }));
vi.mock('@/lib/storefront-content', () => ({ fetchInsightPosts: vi.fn(), fetchPicks: vi.fn() }));

import { metadata } from './page';

const TITLE = 'PetPosture | Dog Product Picks by Breed & Body Type';
const DESCRIPTION =
    'Dog product picks matched to breed and body type. Ramp guides for Dachshunds, harness and feeding guides for French Bulldogs. Browse by breed or need.';

describe('homepage metadata', () => {
    it('has its own title that skips the "| PetPosture" template, and its own description', () => {
        expect(metadata.title).toEqual({ absolute: TITLE });
        expect(metadata.description).toBe(DESCRIPTION);
    });

    it('keeps the canonical at the root', () => {
        expect(metadata.alternates?.canonical).toBe('/');
    });

    it('gives Open Graph and Twitter the same title and description, and an image', () => {
        expect(metadata.openGraph).toMatchObject({ title: TITLE, description: DESCRIPTION, url: '/' });
        expect(metadata.twitter).toMatchObject({ title: TITLE, description: DESCRIPTION });
        expect(metadata.openGraph?.images).toHaveLength(1);
        expect(metadata.twitter?.images).toHaveLength(1);
    });

    it('stays within search-result length: title up to 60, description 140 to 160', () => {
        expect(TITLE.length).toBeLessThanOrEqual(60);
        expect(DESCRIPTION.length).toBeGreaterThanOrEqual(140);
        expect(DESCRIPTION.length).toBeLessThanOrEqual(160);
    });

    it('names only breeds that have published content', () => {
        const mentioned = DESCRIPTION.match(/Dachshunds|French Bulldogs|Corgis|Pugs|English Bulldogs/g);
        expect(mentioned).toEqual(['Dachshunds', 'French Bulldogs']);
    });
});
