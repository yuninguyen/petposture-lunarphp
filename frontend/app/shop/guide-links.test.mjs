import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('ShopPage renders an optional link from the hero to the matching guide', () => {
  const source = read('../../components/ShopPage.tsx');

  assert.ok(source.includes('heroLink?: { href: string; label: string }'), 'heroLink prop is declared');
  assert.ok(source.includes('href={heroLink.href}'), 'the link points at heroLink.href');
  assert.ok(source.includes('{heroLink.label}'), 'the link shows heroLink.label');
  assert.ok(source.includes('{heroLink && ('), 'the link only renders when a page passes one');
});

test('the breed shop page links back to the breed guide', () => {
  const source = read('./breeds/[slug]/page.tsx');

  assert.ok(
    source.includes('heroLink={{ href: `/dogs/${slug}`, label: `Read the ${breed.name} guide` }}'),
    'the breed shop page passes a heroLink to /dogs/<slug>',
  );
});

test('the solution shop page links back to the solution guide', () => {
  const source = read('./solutions/[slug]/page.tsx');

  assert.ok(
    source.includes('heroLink={{ href: `/solutions/${slug}`, label: `Read the ${solution.name.toLowerCase()} guide` }}'),
    'the solution shop page passes a heroLink to /solutions/<slug>',
  );
});
