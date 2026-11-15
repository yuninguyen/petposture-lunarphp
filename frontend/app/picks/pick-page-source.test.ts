import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./[slug]/page.tsx', import.meta.url), 'utf8');

// The Pick page renders per request with a CSP nonce, so its structured data has to carry that nonce.
describe('the /picks/[slug] page source', () => {
    it('emits its structured data in nonce-bearing JSON-LD scripts', () => {
        expect(source).toMatch(/type="application\/ld\+json"/);
        expect(source).toMatch(/nonce=\{nonce\}/);
        expect(source).toMatch(/get\('x-nonce'\)/);
    });

    it('builds the data with the Pick helpers, from SITE_URL', () => {
        expect(source).toContain('buildPickJsonLd');
        expect(source).toContain('buildPickBreadcrumbJsonLd');
        expect(source).toMatch(/from '@\/lib\/site'/);
    });

    it('does not take structured data from the API, whose Product block still points at the shop', () => {
        expect(source).not.toMatch(/product\.seo\b/);
    });

    it('never mentions offers or ratings', () => {
        expect(source).not.toMatch(/offers|aggregateRating/i);
    });
});
