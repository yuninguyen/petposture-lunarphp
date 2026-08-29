import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productTypes = readFileSync(new URL('../../types/shop.ts', import.meta.url), 'utf8');
const productPage = readFileSync(new URL('../../app/shop/[category]/[slug]/page.tsx', import.meta.url), 'utf8');
const blogPage = readFileSync(new URL('../../app/blog/[slug]/page.tsx', import.meta.url), 'utf8');

test('product type exposes optional SEO metadata overrides', () => {
    for (const field of ['title', 'description', 'og_title', 'og_description', 'og_image', 'is_indexable', 'is_followable']) {
        assert.match(productTypes, new RegExp(`${field}\\?:`));
    }
});

test('product metadata uses seoMeta overrides and never canonical_url', () => {
    assert.match(productPage, /product\.seoMeta/);
    assert.match(productPage, /seoMeta\?\.title/);
    assert.match(productPage, /seoMeta\?\.description/);
    assert.match(productPage, /seoMeta\?\.og_title/);
    assert.match(productPage, /seoMeta\?\.og_description/);
    assert.match(productPage, /seoMeta\?\.og_image/);
    assert.match(productPage, /product\.categorySlug/);
    assert.match(productPage, /product\.slug/);
    assert.doesNotMatch(productPage, /canonical_url/);
});

test('product and blog metadata preserve explicit false robots values', () => {
    assert.match(productPage, /seoMeta\?\.is_indexable !== false/);
    assert.match(productPage, /seoMeta\?\.is_followable !== false/);
    assert.match(blogPage, /seo\?\.is_indexable !== false/);
    assert.match(blogPage, /seo\?\.is_followable !== false/);
});
