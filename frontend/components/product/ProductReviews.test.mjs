import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./ProductReviews.tsx', import.meta.url), 'utf8');

test('review form sends purchase identity and anti-abuse fields', () => {
    assert.match(source, /customer_email/);
    assert.match(source, /website/);
    assert.match(source, /maxLength=\{2000\}/);
});

test('verified owner label only renders for verified purchase evidence', () => {
    assert.match(source, /review\.is_verified\s*\?/);
    assert.doesNotMatch(source, /Based on.*Verified Owners/);
});

test('review fetch failures are distinct from zero approved reviews', () => {
    assert.match(source, /const \[fetchError, setFetchError\]/);
    assert.match(source, /setFetchError\(true\)/);
    assert.match(source, /fetchError \?/);
    assert.match(source, /Reviews are temporarily unavailable\./);
    assert.match(source, /reviews\.length === 0 \?/);
    assert.match(source, /No journeys shared yet/);
});
