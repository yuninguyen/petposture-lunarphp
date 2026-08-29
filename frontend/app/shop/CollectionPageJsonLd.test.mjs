import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const routes = [
  ['page.tsx', 'buildShopCollectionJsonLd', { name: 'Shop', description: 'Carefully selected products for everyday access, comfort, and usability. Explore bowls, ramps, beds, and harnesses.', url: 'https://petposture.test/shop' }],
  ['breeds/[slug]/page.tsx', 'buildBreedCollectionJsonLd', { name: 'French Bulldog', description: 'Breed description', url: 'https://petposture.test/shop/breeds/french-bulldog' }],
  ['solutions/[slug]/page.tsx', 'buildSolutionCollectionJsonLd', { name: 'Mobility', description: 'Solution description', url: 'https://petposture.test/shop/solutions/mobility' }],
];

function loadHelper(file, helper) {
  const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  const beforePage = source.slice(0, source.indexOf('export default async function Page'));
  const helperSource = beforePage.split('\n').filter((line) => !line.trimStart().startsWith('import ')).join('\n')
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ')
    + `\nthis.helper = ${helper};`;
  const js = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ JSON, String, Boolean });
  vm.runInContext(js, context);
  return context.helper;
}

test('CollectionPage helpers emit exact names descriptions and URLs', () => {
  for (const [file, helper, expected] of routes) {
    const jsonLd = loadHelper(file, helper)(expected);
    assert.deepEqual(JSON.parse(JSON.stringify(jsonLd)), {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: expected.name,
      description: expected.description,
      url: expected.url,
    });
  }
});

test('route composition uses API summaries and exact fallback contracts', () => {
  const shopSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  assert.match(shopSource, /name: 'Shop'/);
  assert.match(shopSource, /description: 'Carefully selected products for everyday access, comfort, and usability\. Explore bowls, ramps, beds, and harnesses\.'/);
  assert.match(shopSource, /url: `\$\{SITE_URL\}\/shop`/);

  const breedSource = readFileSync(new URL('./breeds/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(breedSource, /name: breed\.name/);
  assert.match(breedSource, /description: breed\.description \|\| `Breed-focused products selected for fit and everyday comfort for \$\{breed\.name\}\.`/);
  assert.match(breedSource, /url: `\$\{SITE_URL\}\/shop\/breeds\/\$\{slug\}`/);
  const breedJsonLd = loadHelper('breeds/[slug]/page.tsx', 'buildBreedCollectionJsonLd')({ name: 'French Bulldog', description: 'Breed-focused products selected for fit and everyday comfort for French Bulldog.', url: 'https://petposture.test/shop/breeds/french-bulldog' });
  assert.equal(breedJsonLd.description, 'Breed-focused products selected for fit and everyday comfort for French Bulldog.');

  const solutionSource = readFileSync(new URL('./solutions/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(solutionSource, /name: solution\.name/);
  assert.match(solutionSource, /description: solution\.description \|\| `Practical, carefully selected products for \$\{solution\.name\.toLowerCase\(\)\}\.`/);
  assert.match(solutionSource, /url: `\$\{SITE_URL\}\/shop\/solutions\/\$\{slug\}`/);
  const solutionJsonLd = loadHelper('solutions/[slug]/page.tsx', 'buildSolutionCollectionJsonLd')({ name: 'Mobility', description: 'Practical, carefully selected products for mobility.', url: 'https://petposture.test/shop/solutions/mobility' });
  assert.equal(solutionJsonLd.description, 'Practical, carefully selected products for mobility.');

  for (const source of [shopSource, breedSource, solutionSource]) {
    assert.doesNotMatch(source, /itemListElement/);
  }
});

test('collection routes wire nonce-bearing JSON-LD and notFound before schema', () => {
  for (const file of ['page.tsx', 'breeds/[slug]/page.tsx', 'solutions/[slug]/page.tsx']) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.match(source, /import \{ headers \} from 'next\/headers'/);
    assert.match(source, /\(await headers\(\)\)\.get\('x-nonce'\)/);
    assert.match(source, /type="application\/ld\+json"/);
    assert.match(source, /nonce=\{nonce\}/);
  }
  for (const file of ['breeds/[slug]/page.tsx', 'solutions/[slug]/page.tsx']) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.ok(source.indexOf('notFound();') < source.indexOf('type="application/ld+json"'));
  }
});
