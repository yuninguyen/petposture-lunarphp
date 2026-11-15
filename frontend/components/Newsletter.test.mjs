import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./Newsletter.tsx', import.meta.url), 'utf8');

// SHOP-HIDDEN: this test used to expect "...after confirmation" (the 10% first-order offer). The banner made a
// promise about an order PetPosture cannot take while the shop is hidden. Reverting the "hide the shop" commits
// puts the offer wording back.
test('pending signup copy asks for confirmation and promises no discount', () => {
    assert.doesNotMatch(source, /You(?:&apos;|')re in!/);
    assert.doesNotMatch(source, /discount code is on its way/i);
    assert.match(source, /Confirm your email/);
    assert.match(source, /after you confirm/i);
});

test('the newsletter banner does not offer money off an order', () => {
    assert.doesNotMatch(source, /10\s*%/);
    assert.doesNotMatch(source, /off your first/i);
    assert.doesNotMatch(source, /first-order/i);
    assert.doesNotMatch(source, /Join & Get/);
});
