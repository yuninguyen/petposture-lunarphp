import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../app/shop/[category]/[slug]/page.tsx', import.meta.url), 'utf8');
const productTypes = readFileSync(new URL('../../types/shop.ts', import.meta.url), 'utf8');

function loadHelpers() {
  const marker = 'export default async function Page';
  let helperSource = source.slice(0, source.indexOf(marker))
    .split('\n').filter((line) => !line.trimStart().startsWith('import ')).join('\n');
  helperSource = helperSource.slice(0, helperSource.indexOf('export async function generateMetadata')).replaceAll('export function ', 'function ')
    + '\nthis.helpers = { buildProductBreadcrumbJsonLd, serializeProductJsonLd };';
  const js = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ URL, URLSearchParams, JSON, String, Array });
  vm.runInContext(js, context);
  return context.helpers;
}

test('ProductJsonLd type mirrors the Laravel Product JSON-LD shape', () => {
  assert.match(productTypes, /'@context': 'https:\/\/schema\.org'/);
  assert.match(productTypes, /'@type': 'Product'/);
  assert.match(productTypes, /name: string/);
  assert.match(productTypes, /url: string/);
  assert.match(productTypes, /offers\?: \{/);
  assert.match(productTypes, /'@type': 'Offer'/);
  assert.match(productTypes, /price: number/);
  assert.match(productTypes, /priceCurrency: string/);
  assert.match(productTypes, /availability: string/);
  assert.match(productTypes, /aggregateRating\?: \{/);
  assert.match(productTypes, /'@type': 'AggregateRating'/);
  assert.match(productTypes, /ratingValue: number/);
  assert.match(productTypes, /reviewCount: number/);
  assert.doesNotMatch(productTypes, /\[key: string\]: unknown/);
});

test('product JSON-LD helpers preserve raw product payload and build breadcrumb variants', () => {
  const { buildProductBreadcrumbJsonLd, serializeProductJsonLd } = loadHelpers();
  const raw = { '@context': 'https://schema.org', '@type': 'Product', name: 'Raw', offers: { price: 12 } };
  assert.equal(serializeProductJsonLd(raw), JSON.stringify(raw));
  assert.equal(serializeProductJsonLd(null), null);
  const generic = buildProductBreadcrumbJsonLd('https://petposture.test', { category: 'Shop', categorySlug: 'categories', slug: 'raw', name: 'Raw' });
  assert.equal(generic.itemListElement.length, 3);
  assert.equal(generic.itemListElement[2].item, 'https://petposture.test/shop/categories/raw');
  const concrete = buildProductBreadcrumbJsonLd('https://petposture.test', { category: 'Beds', categorySlug: 'dog-beds', slug: 'raw', name: 'Raw' });
  assert.equal(concrete.itemListElement.length, 4);
  assert.equal(concrete.itemListElement[2].item, 'https://petposture.test/shop/dog-beds');
  assert.equal(concrete.itemListElement[3].item, 'https://petposture.test/shop/dog-beds/raw');
});

test('product page attaches the request nonce to both JSON-LD scripts', () => {
  assert.match(source, /const nonce = \(await headers\(\)\)\.get\('x-nonce'\)/);
  assert.equal((source.match(/type="application\/ld\+json"/g) || []).length, 2);
  assert.equal((source.match(/nonce=\{nonce\}/g) || []).length, 2);
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: productJsonLd \}\}/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(breadcrumbJsonLd\) \}\}/);
});
