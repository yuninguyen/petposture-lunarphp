import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('./sitemap.ts', import.meta.url), 'utf8');

function loadSitemap(fetchImpl) {
    const transformed = ts.transpileModule(
        source
            .replace("import type { MetadataRoute } from 'next';", '')
            .replace("import { API_BASE_URL } from '@/lib/api';", "const API_BASE_URL = 'https://api.test';")
            .replace("import { SITE_URL } from '@/lib/site';", "const SITE_URL = 'https://petposture.test';")
            .replace('export default async function sitemap', 'async function sitemap'),
        { compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 } },
    ).outputText + '\nthis.sitemap = sitemap;';

    const context = vm.createContext({ fetch: fetchImpl, console, URL, URLSearchParams, Date, Promise, Number, Array });
    vm.runInContext(transformed, context, { filename: 'sitemap.ts' });
    return context.sitemap;
}

test('sitemap paginates products and carries valid updated timestamps', async () => {
    const requests = [];
    const products = Array.from({ length: 201 }, (_, index) => ({
        slug: `product-${index + 1}`,
        categorySlug: 'feeding',
        updated_at: `2026-08-${String((index % 9) + 1).padStart(2, '0')}T12:00:00Z`,
    }));
    const posts = [
        { slug: 'guide-one', updated_at: '2026-08-20T10:00:00Z' },
        { slug: 'guide-two', updated_at: 'not-a-date' },
    ];

    const sitemap = loadSitemap(async (url) => {
        requests.push(String(url));
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/products')) {
            const page = Number(parsed.searchParams.get('page'));
            return {
                ok: true,
                async json() {
                    return {
                        data: products.slice((page - 1) * 100, page * 100),
                        meta: { current_page: page, last_page: 3 },
                    };
                },
            };
        }
        return {
            ok: true,
            async json() {
                return { data: posts };
            },
        };
    });

    const entries = await sitemap();
    const productEntries = entries.filter((entry) => entry.url.includes('/shop/feeding/product-'));
    const postEntries = entries.filter((entry) => entry.url.includes('/blog/guide-'));
    assert.equal(productEntries.length, 201);
    assert.ok(productEntries.every((entry) => entry.lastModified instanceof Date));
    assert.equal(productEntries[0].lastModified.toISOString(), new Date(products[0].updated_at).toISOString());
    assert.equal(productEntries[200].lastModified.toISOString(), new Date(products[200].updated_at).toISOString());
    assert.ok(postEntries[0].lastModified instanceof Date);
    assert.equal(postEntries[0].lastModified.toISOString(), new Date(posts[0].updated_at).toISOString());
    assert.equal(postEntries[1].lastModified, undefined);
    assert.deepEqual(
        requests.filter((url) => url.includes('/products')),
        [1, 2, 3].map((page) => `https://api.test/api/products?page=${page}&per_page=100`),
    );
});
