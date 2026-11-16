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

test('the Picks list has its own canonical URL, whatever the breed filter', () => {
    assert.match(list, /canonical: '\/picks'/);
});
