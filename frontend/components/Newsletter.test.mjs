import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./Newsletter.tsx', import.meta.url), 'utf8');

test('pending signup copy requires confirmation before the discount offer', () => {
    assert.doesNotMatch(source, /You(?:&apos;|')re in!/);
    assert.doesNotMatch(source, /discount code is on its way/i);
    assert.match(source, /Confirm your email/);
    assert.match(source, /after confirmation/i);
});
