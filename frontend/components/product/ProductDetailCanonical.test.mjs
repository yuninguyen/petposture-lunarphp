import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../app/shop/[category]/[slug]/page.tsx', import.meta.url), 'utf8');

test('product detail passes requested category to the API', () => {
    assert.match(source, /query\.set\(['"]category['"], category\)/);
    assert.match(source, /fetchProduct\(slug, category,/);
});

test('product detail uses permanent redirects and preserves the original query string', () => {
    assert.match(source, /import \{ notFound, permanentRedirect \} from ['"]next\/navigation['"]/);
    assert.match(source, /function serializeSearchParams\(searchParams/);
    assert.match(source, /const originalQuery = serializeSearchParams\(await searchParams\)/);
    assert.match(source, /permanentRedirect\(originalQuery \? `\$\{lookup\.redirectPath\}\?\$\{originalQuery\}` : lookup\.redirectPath\)/);
    assert.doesNotMatch(source, /redirect\(originalQuery/);
});

test('product metadata canonical uses API-resolved route fields', () => {
    assert.match(source, /alternates: \{ canonical: `\/shop\/\$\{product\.categorySlug\}\/\$\{product\.slug\}` \}/);
    assert.doesNotMatch(source, /alternates: \{ canonical: `\/shop\/\$\{category\}\/\$\{slug\}` \}/);
});
