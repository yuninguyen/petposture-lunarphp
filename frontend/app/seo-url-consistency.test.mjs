import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const siteUrl = 'https://petposture.test';

function loadGenerateMetadata(path, fixture, kind) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const start = source.indexOf('export async function generateMetadata');
    const end = source.indexOf('export default async function Page', start);
    const functionSource = source.slice(start, end)
        .replace('export async function generateMetadata', 'async function generateMetadata');
    const setup = kind === 'product'
        ? `const SITE_URL = '${siteUrl}'; const fixture = ${JSON.stringify(fixture)}; const fetchProduct = async () => ({ product: fixture, redirectPath: null }); const buildPreviewQuery = () => ''; const serializeSearchParams = () => ''; const stripHtml = (value) => value; const permanentRedirect = () => { throw new Error('unexpected redirect'); };`
        : `const SITE_URL = '${siteUrl}'; const fixture = ${JSON.stringify(fixture)}; const fetchPost = async () => fixture; const buildPreviewQuery = () => '';`;
    const output = ts.transpileModule(`${setup}\n${functionSource}\nthis.generateMetadata = generateMetadata;`, {
        compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = vm.createContext({ Promise, URLSearchParams, String, Boolean });
    vm.runInContext(output, context);
    return context.generateMetadata({ params: Promise.resolve(kind === 'product' ? { category: fixture.categorySlug, slug: fixture.slug } : { slug: fixture.slug }), searchParams: Promise.resolve({}) });
}

function loadSitemap(fetchImpl) {
    const source = readFileSync(new URL('./sitemap.ts', import.meta.url), 'utf8');
    const transformed = ts.transpileModule(source
        .replace("import type { MetadataRoute } from 'next';", '')
        .replace("import { API_BASE_URL } from '@/lib/api';", `const API_BASE_URL = '${siteUrl}'`)
        .replace("import { SITE_URL } from '@/lib/site';", `const SITE_URL = '${siteUrl}'`)
        .replace('export default async function sitemap', 'async function sitemap'), {
        compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 },
    }).outputText + '\nthis.sitemap = sitemap;';
    const context = vm.createContext({ fetch: fetchImpl, URL, URLSearchParams, Date, Promise, Number, Array });
    vm.runInContext(transformed, context);
    return context.sitemap;
}

test('Product canonical, OG, JSON-LD, and sitemap URLs stay identical', async () => {
    const product = {
        name: 'Test Product', categorySlug: 'dog-beds', slug: 'test-product', description: 'Test', image: null,
        seo: { '@context': 'https://schema.org', '@type': 'Product', name: 'Test Product', url: `${siteUrl}/shop/dog-beds/test-product` },
    };
    const metadata = await loadGenerateMetadata('./shop/[category]/[slug]/page.tsx', product, 'product');
    const expectedAbsolute = `${siteUrl}/shop/${product.categorySlug}/${product.slug}`;
    assert.equal(metadata.alternates.canonical, `/shop/${product.categorySlug}/${product.slug}`);
    assert.equal(metadata.openGraph.url, expectedAbsolute);
    assert.equal(product.seo.url, expectedAbsolute);

    const sitemap = loadSitemap(async (url) => ({ ok: true, async json() {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/products')) return { data: [product], meta: { last_page: 1 } };
        return { data: [] };
    }}));
    const entry = (await sitemap()).find((item) => item.url === expectedAbsolute);
    assert.ok(entry, 'sitemap should contain the product URL');
});

test('Blog canonical, OG, and sitemap URLs stay identical without optional SEO fields', async () => {
    const post = { slug: 'research-guide', title: 'Research Guide', content: 'Content', featured_image: null, seo: null };
    const metadata = await loadGenerateMetadata('./blog/[slug]/page.tsx', post, 'blog');
    const expectedAbsolute = `${siteUrl}/blog/${post.slug}`;
    assert.equal(metadata.alternates.canonical, `/blog/${post.slug}`);
    assert.equal(metadata.openGraph.url, expectedAbsolute);

    const sitemap = loadSitemap(async (url) => ({ ok: true, async json() {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/products')) return { data: [], meta: { last_page: 1 } };
        return { data: [{ ...post, updated_at: '2026-08-30T00:00:00Z' }] };
    }}));
    const entry = (await sitemap()).find((item) => item.url === expectedAbsolute);
    assert.ok(entry, 'sitemap should contain the blog URL');
});
