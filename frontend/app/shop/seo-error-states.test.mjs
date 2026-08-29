import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const breedDetailSource = readFileSync(new URL('./breeds/[slug]/page.tsx', import.meta.url), 'utf8');
const solutionDetailSource = readFileSync(new URL('./solutions/[slug]/page.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../../hooks/useShopLogic.ts', import.meta.url), 'utf8');
const shopSource = readFileSync(new URL('../../components/ShopPage.tsx', import.meta.url), 'utf8');

test('shop never imports or references mock products', () => {
    for (const source of [pageSource, breedDetailSource, solutionDetailSource, hookSource]) {
        assert.doesNotMatch(source, /MOCK_PRODUCTS|shopData/);
    }
});

test('detail shop pages preserve API error versus empty result state', () => {
    for (const source of [breedDetailSource, solutionDetailSource]) {
        assert.match(source, /products: Product\[\]; error: boolean/);
        assert.match(source, /initialProductsError=\{initialProductResult\.error\}/);
        assert.match(source, /return \{ products: \[\], error: true \}/);
        assert.doesNotMatch(source, /Falling back to mock|MOCK_PRODUCTS|shopData/);
    }
});

test('shop models initial and filter failures separately from empty results', () => {
    assert.match(pageSource, /products: Product\[\]; error: boolean/);
    assert.match(pageSource, /initialProductsError=\{initialProductResult\.error\}/);
    assert.match(hookSource, /initialProductsError = false/);
    assert.match(hookSource, /const \[filterError, setFilterError\]/);
    assert.match(hookSource, /filterError,/);
    assert.match(shopSource, /shopLogic\.initialError \|\| shopLogic\.filterError/);
});

test('shop renders explicit failure and true-empty states', () => {
    assert.match(shopSource, /role="alert"/);
    assert.match(shopSource, /Unable to load products/);
    assert.match(shopSource, /No products available/);
});
