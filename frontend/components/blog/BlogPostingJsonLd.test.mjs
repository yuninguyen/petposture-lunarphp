import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../app/blog/[slug]/page.tsx', import.meta.url), 'utf8');

test('Blog page renders nonce-bearing BlogPosting JSON-LD from post fields', () => {
  assert.match(source, /application\/ld\+json/);
  assert.match(source, /@type.*BlogPosting/);
  assert.match(source, /post\.title/);
  assert.match(source, /post\.created_at/);
  assert.doesNotMatch(source, /post\.published_at/);
  assert.match(source, /SITE_URL.*blog/);
  assert.match(source, /nonce=\{nonce\}/);
});

test('BlogPosting uses safe excerpt fallback and optional fields', () => {
  assert.match(source, /seo\?\.description/);
  assert.match(source, /post\.content\?\.slice\(0, 160\)/);
  assert.match(source, /post\.featured_image/);
  assert.doesNotMatch(source, /rating|price|availability/);
});
