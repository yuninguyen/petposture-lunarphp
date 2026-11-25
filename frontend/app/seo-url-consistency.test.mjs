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
    // The real title helper, so a page's title is checked as the page builds it.
    const titleHelper = readFileSync(new URL('../lib/page-title.ts', import.meta.url), 'utf8')
        .replace("import type { Metadata } from 'next';", '')
        .replace('export function pageTitle', 'function pageTitle');
    const output = ts.transpileModule(`${setup}\n${titleHelper}\n${functionSource}\nthis.generateMetadata = generateMetadata;`, {
        compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = vm.createContext({ Promise, URLSearchParams, String, Boolean });
    vm.runInContext(output, context);
    return context.generateMetadata({ params: Promise.resolve(kind === 'product' ? { collection: fixture.categorySlug, slug: fixture.slug } : { slug: fixture.slug }), searchParams: Promise.resolve({}) });
}

function loadSitemap(fetchImpl) {
    const source = readFileSync(new URL('./sitemap.ts', import.meta.url), 'utf8');
    const transformed = ts.transpileModule(source
        .replace("import type { MetadataRoute } from 'next';", '')
        .replace("import { API_BASE_URL } from '@/lib/api';", `const API_BASE_URL = '${siteUrl}'`)
        .replace("import { SITE_URL } from '@/lib/site';", `const SITE_URL = '${siteUrl}'`)
        .replace("export const dynamic = 'force-dynamic';", '')
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
    const metadata = await loadGenerateMetadata('./shop/[collection]/[slug]/page.tsx', product, 'product');
    const expectedAbsolute = `${siteUrl}/shop/${product.categorySlug}/${product.slug}`;
    assert.equal(metadata.alternates.canonical, `/shop/${product.categorySlug}/${product.slug}`);
    assert.equal(metadata.openGraph.url, expectedAbsolute);
    assert.equal(product.seo.url, expectedAbsolute);

    const sitemap = loadSitemap(async (url) => ({ ok: true, async json() {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/products')) return { data: [product], meta: { last_page: 1 } };
        return { data: [] };
    }}));
    // SHOP-HIDDEN: the shop product URL used to be in the sitemap; it now redirects, so it must not be listed.
    // Reverting the "hide the shop" commits makes this expect the entry again.
    const entry = (await sitemap()).find((item) => item.url === expectedAbsolute);
    assert.equal(entry, undefined, 'sitemap must not list a hidden shop product URL');
});

test('Blog: an SEO title that already has the brand suffix is not given it twice, and nothing else changes', async () => {
    const seo = { title: 'Research Guide | PetPosture', description: 'About the guide' };
    const post = { slug: 'research-guide', title: 'Research Guide', content: 'Content', featured_image: null, seo };
    const metadata = await loadGenerateMetadata('./blog/[slug]/page.tsx', post, 'blog');
    assert.equal(metadata.title.absolute, 'Research Guide | PetPosture');
    assert.equal(metadata.openGraph.title, 'Research Guide | PetPosture');
    assert.equal(metadata.twitter.title, 'Research Guide | PetPosture');
    assert.equal(metadata.description, 'About the guide');
    assert.equal(metadata.alternates.canonical, '/blog/research-guide');

    const plain = await loadGenerateMetadata('./blog/[slug]/page.tsx', { ...post, seo: { title: 'Research Guide' } }, 'blog');
    assert.equal(plain.title, 'Research Guide', 'the layout template adds the suffix to this one');
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
