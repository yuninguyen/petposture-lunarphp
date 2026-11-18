import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detail = readFileSync(new URL('./[slug]/page.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

// The API sends "id" and never "productId". Matching on productId made "More PetPosture Picks" come out empty:
// every candidate looked like the Pick being viewed.
test('the Pick page picks related Picks by id, through the shared helper, never by productId', () => {
    assert.doesNotMatch(detail, /productId/);
    assert.match(detail, /relatedPicks\(products, current\.id,/);
});

test('the Picks list and a Pick page are rendered per request so their CSP nonce matches the body', () => {
    assert.match(detail, /await headers\(\)/);
    assert.match(list, /await headers\(\)/);
});

test('the Picks list reads both filters and the page from the URL and hands them to the list', () => {
    assert.match(list, /breed: rawBreed, solution: rawSolution, page: rawPage/);
    assert.match(list, /<PicksIndex allPicks=\{all\} breed=\{breed\} solution=\{solution\} page=\{page\}/);
});

test('the Picks list is canonical at /picks for the first page and for every filtered view; page 2 and on have their own', () => {
    assert.match(list, /page > 1 && !filtered \? picksHref\(\{ breed: null, solution: null, page \}\) : '\/picks'/);
});

test('a page past the end goes to the last page', () => {
    assert.match(list, /if \(page > pages\) redirect\(picksHref\(\{ breed, solution, page: pages \}\)\)/);
});
