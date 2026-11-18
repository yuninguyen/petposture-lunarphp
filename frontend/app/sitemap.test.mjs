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
            .replace("export const dynamic = 'force-dynamic';", '')
            .replace('export default async function sitemap', 'async function sitemap'),
        { compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 } },
    ).outputText + '\nthis.sitemap = sitemap;';

    const context = vm.createContext({ fetch: fetchImpl, console, URL, URLSearchParams, Date, Promise, Number, Array });
    vm.runInContext(transformed, context, { filename: 'sitemap.ts' });
    return context.sitemap;
}

// SHOP-HIDDEN: this test also required fifteen /shop URLs (/shop, /shop/breeds/*, /shop/solutions/*). The shop
// is hidden and those URLs redirect, so none may be listed. Reverting the "hide the shop" commits restores them.
test('sitemap lists the breed and solution guides and no hidden shop page', async () => {
    const sitemap = loadSitemap(async () => ({ ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } }));
    const urls = new Set((await sitemap()).map((entry) => entry.url));

    for (const path of [
        '/', '/blog', '/faqs',
        '/dogs', '/dogs/dachshund', '/dogs/french-bulldog', '/dogs/pug', '/dogs/corgi', '/dogs/english-bulldog',
        '/solutions', '/solutions/feeding', '/solutions/comfort', '/solutions/mobility', '/solutions/walking',
    ]) {
        assert.ok(urls.has(`https://petposture.test${path}`), `sitemap should contain ${path}`);
    }
    assert.ok(!urls.has('https://petposture.test/track-order'));
    assert.deepEqual(Array.from(urls).filter((url) => /\/shop(\/|$)/.test(url)), []);

    // SHOP-HIDDEN: the shipping and returns policy pages are unlinked and PetPosture ships nothing, so they
    // are not advertised to search engines either. Reverting the "hide the shop" commits lists them again.
    for (const path of ['/shipping-policy', '/return-refund-policy', '/returns']) {
        assert.ok(!urls.has(`https://petposture.test${path}`), `sitemap must not list ${path}`);
    }
    for (const path of ['/privacy-policy', '/terms-and-conditions', '/cookie-policy', '/acceptable-use-policy', '/affiliate-disclosure']) {
        assert.ok(urls.has(`https://petposture.test${path}`), `sitemap should still list ${path}`);
    }
});

test('sitemap lists the Picks list page', async () => {
    const sitemap = loadSitemap(async () => ({ ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } }));
    const urls = new Set((await sitemap()).map((entry) => entry.url));

    assert.ok(urls.has('https://petposture.test/picks'));
});

test('sitemap lists each Pick at /picks/<slug>, with no stock check and no ordinary product', async () => {
    const sitemap = loadSitemap(async (url) => {
        const parsed = new URL(url);
        if (!parsed.pathname.endsWith('/products')) {
            return { ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } };
        }
        return {
            ok: true,
            async json() {
                return {
                    data: [
                        { slug: 'necoichi-bowl', categorySlug: 'bowls', updated_at: '2026-11-15T10:00:00Z', stockStatus: 'out_of_stock', available: false, pick: { goUrl: 'https://api.test/go/pick/necoichi-bowl' } },
                        { slug: 'ordinary-product', categorySlug: 'bowls', pick: null },
                        { slug: 'no-pick-key', categorySlug: 'bowls' },
                        { categorySlug: 'bowls', pick: { goUrl: 'https://api.test/go/pick/x' } },
                    ],
                    meta: { last_page: 1 },
                };
            },
        };
    });

    const entries = await sitemap();
    const pickEntries = entries.filter((entry) => entry.url.includes('/picks/'));

    // Array.from: the sitemap runs in a vm context, whose arrays are not the same realm as the test's.
    assert.deepEqual(Array.from(pickEntries, (entry) => entry.url), ['https://petposture.test/picks/necoichi-bowl']);
    assert.equal(pickEntries[0].lastModified.toISOString(), new Date('2026-11-15T10:00:00Z').toISOString());
    assert.ok(!entries.some((entry) => entry.url.endsWith('/picks/ordinary-product')));
    assert.ok(!entries.some((entry) => entry.url.endsWith('/picks/no-pick-key')));
});

test('sitemap follows every page of posts instead of stopping at the first', async () => {
    const requests = [];
    const posts = Array.from({ length: 25 }, (_, index) => ({ slug: `guide-${index + 1}` }));

    const sitemap = loadSitemap(async (url) => {
        requests.push(String(url));
        const parsed = new URL(url);
        if (!parsed.pathname.endsWith('/posts')) {
            return { ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } };
        }
        const page = Number(parsed.searchParams.get('page'));
        return {
            ok: true,
            async json() {
                return { data: posts.slice((page - 1) * 12, page * 12), meta: { current_page: page, last_page: 3 } };
            },
        };
    });

    const entries = await sitemap();
    assert.equal(entries.filter((entry) => entry.url.includes('/blog/guide-')).length, 25);
    assert.deepEqual(
        requests.filter((url) => url.includes('/posts')),
        [1, 2, 3].map((page) => `https://api.test/api/posts?page=${page}`),
    );
});

test('sitemap looks at the posts every five minutes and at the products every hour', async () => {
    const seen = [];
    const sitemap = loadSitemap(async (url, init) => {
        seen.push({ url: String(url), revalidate: init?.next?.revalidate });

        return { ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } };
    });

    await sitemap();

    const revalidateFor = (path) => seen.filter((call) => call.url.includes(path)).map((call) => call.revalidate);

    assert.deepEqual(revalidateFor('/api/posts'), [300]);
    assert.ok(revalidateFor('/api/products').length > 0);
    assert.ok(revalidateFor('/api/products').every((seconds) => seconds === 3600));
});

test('sitemap keeps the posts it already fetched when a later page fails', async () => {
    const sitemap = loadSitemap(async (url) => {
        const parsed = new URL(url);
        if (!parsed.pathname.endsWith('/posts')) {
            return { ok: true, async json() { return { data: [], meta: { last_page: 1 } }; } };
        }
        if (parsed.searchParams.get('page') === '2') return { ok: false, async json() { return {}; } };
        return { ok: true, async json() { return { data: [{ slug: 'guide-1' }], meta: { last_page: 2 } }; } };
    });

    const entries = await sitemap();
    assert.equal(entries.filter((entry) => entry.url.includes('/blog/guide-')).length, 1);
});

test('sitemap paginates products and carries valid updated timestamps', async () => {
    const requests = [];
    const products = Array.from({ length: 201 }, (_, index) => ({
        slug: `product-${index + 1}`,
        categorySlug: 'feeding',
        pick: { goUrl: `https://api.test/go/pick/product-${index + 1}` },
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
    // SHOP-HIDDEN: these were /shop/feeding/product-N entries; the Pick pages are what the sitemap lists now.
    const productEntries = entries.filter((entry) => entry.url.includes('/picks/product-'));
    const postEntries = entries.filter((entry) => entry.url.includes('/blog/guide-'));
    assert.equal(entries.filter((entry) => /\/shop(\/|$)/.test(entry.url)).length, 0);
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
